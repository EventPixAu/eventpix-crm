# Memory: features/team-management/activation-and-onboarding-status
Updated: now

The Team Directory tracks account activation and profile completion through an onboarding workflow.

## Onboarding Status Lifecycle
1. **Incomplete** - Profile missing basic info (name, business/ABN or address)
2. **Pending Review** - Auto-set when crew member saves profile with basic info; signals ready for admin review
3. **Active** - Approved by admin; eligible for event assignments
4. **Suspended** - Temporarily blocked from assignments

## UI Indicators
- Personnel are marked "Pending" if they lack a linked user account
- Linked accounts display the specific onboarding status badge
- "Active" status badge is hidden to avoid duplicate "Active" badges alongside employment status

## Admin Review Workflow
Admins can approve profiles in two ways:
1. **Quick Approve**: Click the green "Approve" button next to the "Pending Review" badge on the Staff Detail summary card
2. **Compliance Tab**: Use "Change Status" button in the Compliance tab for full status control with notes

Both methods use the `useUpdateOnboardingStatus` hook to update `profiles.onboarding_status`.
