import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { MyDocumentsUploader } from '@/components/MyDocumentsUploader';

export default function MyDocuments() {
  return (
    <AppLayout>
      <PageHeader
        title="My Documents"
        description="Upload and manage your compliance documents"
      />
      <MyDocumentsUploader />
    </AppLayout>
  );
}
