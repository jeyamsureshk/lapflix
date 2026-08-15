import { File, Folder, FileText, Image, Video, FileCode } from 'lucide-react-native';
import type { FileItem } from '@/lib/types';
import { Colors } from '@/lib/theme';

export function getFileIcon(item: FileItem, size = 22, color?: string) {
  if (item.type === 'folder') {
    return <Folder size={size} color={color || Colors.primary[500]} strokeWidth={2} />;
  }
  if (item.type === 'photo') {
    return <Image size={size} color={color || Colors.accent[600]} strokeWidth={2} />;
  }
  if (item.type === 'video') {
    return <Video size={size} color={color || Colors.warning[600]} strokeWidth={2} />;
  }
  if (item.type === 'text') {
    return <FileText size={size} color={color || Colors.neutral[500]} strokeWidth={2} />;
  }
  return <File size={size} color={color || Colors.neutral[400]} strokeWidth={2} />;
}

export { FileCode };
