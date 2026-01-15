import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExpiringDocument {
  id: string;
  user_id: string;
  expiry_date: string;
  status: string;
  days_until_expiry: number;
  document_type: {
    name: string;
  };
  profile: {
    email: string;
    full_name: string | null;
  };
}

interface AdminProfile {
  email: string;
  full_name: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://app.eventpix.com.au";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting compliance expiry check...");

    // Get current date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate dates for 7 days and 30 days from now
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];
    
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Find documents that are:
    // 1. Already expired (expiry_date < today)
    // 2. Expiring within 7 days
    // 3. Expiring within 30 days
    const { data: documents, error: docsError } = await supabase
      .from("staff_compliance_documents")
      .select(`
        id,
        user_id,
        expiry_date,
        status,
        document_type:compliance_document_types(name),
        profile:profiles(email, full_name)
      `)
      .lte("expiry_date", thirtyDaysStr)
      .in("status", ["valid", "pending_review"]);

    if (docsError) {
      throw new Error(`Failed to fetch documents: ${docsError.message}`);
    }

    console.log(`Found ${documents?.length || 0} documents to check`);

    // Process documents and calculate days until expiry
    const expiringDocs: ExpiringDocument[] = (documents || []).map((doc: any) => {
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...doc,
        days_until_expiry: daysUntilExpiry,
        document_type: doc.document_type,
        profile: doc.profile,
      };
    });

    // Categorize documents
    const expiredDocs = expiringDocs.filter(d => d.days_until_expiry < 0);
    const criticalDocs = expiringDocs.filter(d => d.days_until_expiry >= 0 && d.days_until_expiry <= 7);
    const warningDocs = expiringDocs.filter(d => d.days_until_expiry > 7 && d.days_until_expiry <= 30);

    console.log(`Expired: ${expiredDocs.length}, Critical (≤7 days): ${criticalDocs.length}, Warning (8-30 days): ${warningDocs.length}`);

    // Update expired documents status
    const expiredIds = expiredDocs.map(d => d.id);
    if (expiredIds.length > 0) {
      const { error: updateError } = await supabase
        .from("staff_compliance_documents")
        .update({ status: "expired" })
        .in("id", expiredIds);

      if (updateError) {
        console.error("Failed to update expired documents:", updateError);
      } else {
        console.log(`Updated ${expiredIds.length} documents to expired status`);
      }

      // Also downgrade onboarding status for affected users
      const affectedUserIds = [...new Set(expiredDocs.map(d => d.user_id))];
      for (const userId of affectedUserIds) {
        // Check if user has onboarding_status = 'active'
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_status")
          .eq("id", userId)
          .single();

        if (profile?.onboarding_status === "active") {
          await supabase
            .from("profiles")
            .update({ 
              onboarding_status: "incomplete",
              onboarding_notes: `Status automatically changed to incomplete due to expired compliance documents on ${todayStr}`
            })
            .eq("id", userId);
          console.log(`Downgraded onboarding status for user ${userId}`);
        }
      }
    }

    // Get admin users for summary notification
    const { data: adminRoles, error: adminError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminError) {
      console.error("Failed to fetch admin roles:", adminError);
    }

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];
    
    let adminProfiles: AdminProfile[] = [];
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("id", adminUserIds);
      adminProfiles = profiles || [];
    }

    // Send notifications
    const notifications: { type: string; recipient: string; sent: boolean }[] = [];

    // 1. Notify staff about their expiring documents (critical only - 7 days or less)
    const staffToNotify = new Map<string, ExpiringDocument[]>();
    for (const doc of [...expiredDocs, ...criticalDocs]) {
      if (!doc.profile?.email) continue;
      if (!staffToNotify.has(doc.user_id)) {
        staffToNotify.set(doc.user_id, []);
      }
      staffToNotify.get(doc.user_id)!.push(doc);
    }

    for (const [userId, docs] of staffToNotify) {
      const profile = docs[0].profile;
      if (!profile?.email) continue;

      const result = await sendStaffNotification(
        resendKey,
        profile.email,
        profile.full_name || "Team Member",
        docs,
        appUrl
      );
      notifications.push({ type: "staff", recipient: profile.email, sent: result.success });
    }

    // 2. Send admin summary if there are any expiring documents
    if (adminProfiles.length > 0 && expiringDocs.length > 0) {
      for (const admin of adminProfiles) {
        const result = await sendAdminSummary(
          resendKey,
          admin.email,
          admin.full_name || "Admin",
          expiredDocs,
          criticalDocs,
          warningDocs,
          appUrl
        );
        notifications.push({ type: "admin", recipient: admin.email, sent: result.success });
      }
    }

    const summary = {
      checked_at: new Date().toISOString(),
      documents_checked: documents?.length || 0,
      expired: expiredDocs.length,
      critical: criticalDocs.length,
      warning: warningDocs.length,
      notifications_sent: notifications.filter(n => n.sent).length,
      dry_run: !resendKey,
    };

    console.log("Compliance check complete:", summary);

    return new Response(
      JSON.stringify({ success: true, ...summary }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-compliance-expiry:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function sendStaffNotification(
  resendKey: string | undefined,
  email: string,
  name: string,
  docs: ExpiringDocument[],
  appUrl: string
): Promise<{ success: boolean }> {
  const expiredCount = docs.filter(d => d.days_until_expiry < 0).length;
  const expiringCount = docs.length - expiredCount;
  
  const subject = expiredCount > 0 
    ? `⚠️ Urgent: You have ${expiredCount} expired compliance document${expiredCount > 1 ? 's' : ''}`
    : `⏰ Reminder: ${expiringCount} document${expiringCount > 1 ? 's' : ''} expiring soon`;

  const docListHtml = docs.map(doc => {
    const status = doc.days_until_expiry < 0 
      ? `<span style="color: #dc2626; font-weight: bold;">EXPIRED</span>`
      : `<span style="color: #f59e0b; font-weight: bold;">Expires in ${doc.days_until_expiry} days</span>`;
    return `<li>${doc.document_type?.name || 'Document'} - ${status}</li>`;
  }).join('');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${expiredCount > 0 ? '#dc2626' : '#f59e0b'}; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 20px; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; }
    .doc-list { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .doc-list ul { margin: 0; padding-left: 20px; }
    .doc-list li { margin: 8px 0; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${expiredCount > 0 ? '⚠️ Compliance Documents Expired' : '⏰ Documents Expiring Soon'}</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>${expiredCount > 0 
        ? 'Some of your compliance documents have expired. Please upload renewals as soon as possible to maintain your assignment eligibility.'
        : 'This is a reminder that some of your compliance documents are expiring soon. Please upload renewals before they expire.'
      }</p>
      
      <div class="doc-list">
        <strong>Documents requiring attention:</strong>
        <ul>${docListHtml}</ul>
      </div>
      
      <a href="${appUrl}/my-documents" class="button">Upload Documents</a>
      
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        If you have already submitted updated documents, please allow time for admin review.
      </p>
    </div>
    <div class="footer">
      <p>Eventpix - Event Photography Management</p>
    </div>
  </div>
</body>
</html>
  `;

  if (!resendKey) {
    console.log("=== DRY RUN: Staff Notification ===");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log("Documents:", docs.map(d => d.document_type?.name).join(", "));
    return { success: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Eventpix <notifications@eventpix.com.au>",
        to: [email],
        subject: subject,
        html: emailHtml,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Failed to send staff notification:", result);
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send staff notification:", error);
    return { success: false };
  }
}

async function sendAdminSummary(
  resendKey: string | undefined,
  email: string,
  name: string,
  expired: ExpiringDocument[],
  critical: ExpiringDocument[],
  warning: ExpiringDocument[],
  appUrl: string
): Promise<{ success: boolean }> {
  const total = expired.length + critical.length + warning.length;
  const subject = `📋 Compliance Summary: ${expired.length} expired, ${critical.length} critical, ${warning.length} warning`;

  const buildDocTable = (docs: ExpiringDocument[], title: string, color: string) => {
    if (docs.length === 0) return '';
    const rows = docs.map(doc => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${doc.profile?.full_name || 'Unknown'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${doc.document_type?.name || 'Document'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(doc.expiry_date).toLocaleDateString('en-AU')}</td>
      </tr>
    `).join('');
    
    return `
      <div style="margin-bottom: 24px;">
        <h3 style="color: ${color}; margin-bottom: 12px;">${title} (${docs.length})</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left;">Staff Member</th>
              <th style="padding: 8px; text-align: left;">Document</th>
              <th style="padding: 8px; text-align: left;">Expiry Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 20px; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { flex: 1; background: white; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Daily Compliance Report</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Here's your daily compliance document summary:</p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color: #dc2626;">${expired.length}</div>
          <div class="stat-label">Expired</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #f59e0b;">${critical.length}</div>
          <div class="stat-label">≤7 Days</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #3b82f6;">${warning.length}</div>
          <div class="stat-label">8-30 Days</div>
        </div>
      </div>
      
      ${buildDocTable(expired, '🚨 Expired Documents', '#dc2626')}
      ${buildDocTable(critical, '⚠️ Expiring Within 7 Days', '#f59e0b')}
      ${buildDocTable(warning, '📅 Expiring Within 30 Days', '#3b82f6')}
      
      <a href="${appUrl}/staff" class="button">Review in Eventpix</a>
    </div>
    <div class="footer">
      <p>Eventpix - Event Photography Management</p>
      <p>This is an automated daily report.</p>
    </div>
  </div>
</body>
</html>
  `;

  if (!resendKey) {
    console.log("=== DRY RUN: Admin Summary ===");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log(`Summary: ${expired.length} expired, ${critical.length} critical, ${warning.length} warning`);
    return { success: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Eventpix <notifications@eventpix.com.au>",
        to: [email],
        subject: subject,
        html: emailHtml,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Failed to send admin summary:", result);
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send admin summary:", error);
    return { success: false };
  }
}

serve(handler);
