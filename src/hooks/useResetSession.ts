import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceId } from './useDeviceId';

const LOCAL_STORAGE_KEYS = [
  'bible-study-device-id',
  'bible-study-language',
  'bible-study-organization',
  'bible-study-version-preferences',
  'ui-translations-cache',
];

export function useResetSession() {
  const deviceId = useDeviceId();

  const resetSession = useCallback(async (): Promise<boolean> => {
    if (!deviceId) return false;

    try {
      // Delete all messages for this device's conversations first (due to FK constraint)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('device_id', deviceId);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        await supabase
          .from('messages')
          .delete()
          .in('conversation_id', conversationIds);
      }

      // Delete all conversations for this device
      await supabase
        .from('conversations')
        .delete()
        .eq('device_id', deviceId);

      // Delete all notes for this device
      await supabase
        .from('notes')
        .delete()
        .eq('device_id', deviceId);

      // Clear all localStorage keys
      LOCAL_STORAGE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });

      // Force page reload to reset all state
      window.location.reload();
      return true;
    } catch (error) {
      console.error('Error resetting session:', error);
      return false;
    }
  }, [deviceId]);

  return { resetSession };
}
