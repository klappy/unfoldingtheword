import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

type NoteAction = 'create' | 'read' | 'update' | 'delete';
type NoteScope = 'all' | 'book' | 'chapter' | 'verse';

interface NoteRequest {
  action: NoteAction;
  device_id: string;
  // For create/update
  content?: string;
  source_reference?: string;
  note_type?: 'note' | 'bug_report';
  // For read
  scope?: NoteScope;
  reference?: string;
  limit?: number;
  // For update/delete
  note_id?: string;
}

interface Note {
  id: string;
  device_id: string;
  content: string;
  source_reference: string | null;
  note_type: string;
  highlighted: boolean;
  created_at: string;
  updated_at: string;
}

interface NoteResponse {
  success: boolean;
  action: NoteAction;
  notes?: Note[];
  note?: Note;
  count?: number;
  error?: string;
  _timing?: { startMs: number; endMs: number; durationMs: number };
}

// Parse reference to extract book/chapter for scoping
function parseReferenceScope(reference: string): { book?: string; chapter?: number } {
  const match = reference.match(/^(.+?)\s+(\d+)/);
  if (match) {
    return {
      book: match[1].trim(),
      chapter: parseInt(match[2], 10),
    };
  }
  return { book: reference };
}

serve(async (req) => {
  const startMs = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: NoteRequest = await req.json();
    const { action, device_id, content, source_reference, note_type, scope, reference, limit, note_id } = request;

    if (!device_id) {
      return new Response(JSON.stringify({
        success: false,
        action,
        error: 'device_id is required',
        _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log(`[note-agent] Action: ${action} for device: ${device_id.substring(0, 8)}...`);

    let response: NoteResponse;

    switch (action) {
      case 'create': {
        if (!content) {
          return new Response(JSON.stringify({
            success: false,
            action,
            error: 'content is required for create',
            _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await supabase
          .from('notes')
          .insert({
            device_id,
            content,
            source_reference: source_reference || null,
            note_type: note_type || 'note',
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`[note-agent] Created note: ${data.id}`);
        response = { success: true, action, note: data };
        break;
      }

      case 'read': {
        let query = supabase
          .from('notes')
          .select('*')
          .eq('device_id', device_id)
          .order('created_at', { ascending: false });

        // Apply scope filtering
        if (scope && scope !== 'all' && reference) {
          const parsed = parseReferenceScope(reference);
          
          if (scope === 'verse') {
            // Exact reference match
            query = query.eq('source_reference', reference);
          } else if (scope === 'chapter' && parsed.book && parsed.chapter) {
            // Match chapter prefix (e.g., "John 3" matches "John 3:16", "John 3:5")
            query = query.like('source_reference', `${parsed.book} ${parsed.chapter}%`);
          } else if (scope === 'book' && parsed.book) {
            // Match book prefix (e.g., "John" matches "John 3:16", "John 1:1")
            query = query.like('source_reference', `${parsed.book}%`);
          }
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;

        console.log(`[note-agent] Read ${data.length} notes`);
        response = { success: true, action, notes: data, count: data.length };
        break;
      }

      case 'update': {
        if (!note_id) {
          return new Response(JSON.stringify({
            success: false,
            action,
            error: 'note_id is required for update',
            _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (source_reference !== undefined) updateData.source_reference = source_reference;
        if (note_type !== undefined) updateData.note_type = note_type;

        const { data, error } = await supabase
          .from('notes')
          .update(updateData)
          .eq('id', note_id)
          .eq('device_id', device_id) // Ensure user owns the note
          .select()
          .single();

        if (error) throw error;

        console.log(`[note-agent] Updated note: ${note_id}`);
        response = { success: true, action, note: data };
        break;
      }

      case 'delete': {
        if (!note_id) {
          return new Response(JSON.stringify({
            success: false,
            action,
            error: 'note_id is required for delete',
            _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', note_id)
          .eq('device_id', device_id); // Ensure user owns the note

        if (error) throw error;

        console.log(`[note-agent] Deleted note: ${note_id}`);
        response = { success: true, action };
        break;
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          action,
          error: `Unknown action: ${action}`,
          _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const endMs = Date.now();
    response._timing = { startMs, endMs, durationMs: endMs - startMs };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[note-agent] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      action: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      _timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
