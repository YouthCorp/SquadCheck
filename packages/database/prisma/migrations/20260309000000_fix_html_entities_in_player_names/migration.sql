-- Fix HTML entities in player names (e.g. "N. O&apos;Reilly" → "N. O'Reilly")
UPDATE players
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  name,
  '&apos;', chr(39)),
  '&amp;',  '&'),
  '&quot;', '"'),
  '&lt;',   '<'),
  '&gt;',   '>')
WHERE name LIKE '%&%';
