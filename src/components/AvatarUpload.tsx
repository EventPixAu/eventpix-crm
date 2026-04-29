import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  userName: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
}

export function AvatarUpload({ 
  userId, 
  currentAvatarUrl, 
  userName,
  size = 'lg',
  editable = true 
}: AvatarUploadProps) {
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20',
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}/avatar.${fileExt}`;

      // Delete existing avatar if present
      if (currentAvatarUrl) {
        const existingPath = currentAvatarUrl.split('/avatars/')[1];
        if (existingPath) {
          await supabase.storage.from('avatars').remove([existingPath]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL (add cache buster)
      const avatarUrlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrlWithCacheBuster })
        .eq('id', userId);

      if (updateError) throw updateError;

      return avatarUrlWithCacheBuster;
    },
    onSuccess: () => {
      toast.success('Avatar updated successfully');
      queryClient.invalidateQueries({ queryKey: ['staff-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload avatar');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (currentAvatarUrl) {
        const existingPath = currentAvatarUrl.split('/avatars/')[1]?.split('?')[0];
        if (existingPath) {
          await supabase.storage.from('avatars').remove([existingPath]);
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Avatar removed');
      queryClient.invalidateQueries({ queryKey: ['staff-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
    },
    onError: () => {
      toast.error('Failed to remove avatar');
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const isLoading = uploadMutation.isPending || removeMutation.isPending;
  const initials = userName?.[0]?.toUpperCase() || '?';

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={currentAvatarUrl || undefined} />
        <AvatarFallback className="text-2xl bg-primary/20 text-primary">
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : initials}
        </AvatarFallback>
      </Avatar>

      {editable && (isHovering || isLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          {isLoading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Camera className="h-4 w-4" />
              </Button>
              {currentAvatarUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => removeMutation.mutate()}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </div>
  );
}