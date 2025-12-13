-- Rename resources column to tool_calls and add navigation_hint
ALTER TABLE public.messages 
  RENAME COLUMN resources TO tool_calls;

-- Add navigation_hint column for UI navigation
ALTER TABLE public.messages 
  ADD COLUMN navigation_hint text;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.tool_calls IS 'Array of {tool, args} objects representing MCP tool calls made during this response';
COMMENT ON COLUMN public.messages.navigation_hint IS 'UI navigation hint: scripture, search, resources, notes, or null';