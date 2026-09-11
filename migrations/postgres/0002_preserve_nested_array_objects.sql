-- A string -> lookup does not address a JSON array index in PostgreSQL.
-- #> handles both object keys and array indexes, preserving sibling fields.
CREATE OR REPLACE FUNCTION ed_set_inner(doc jsonb, path text[], val jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE child jsonb;
BEGIN
 IF array_length(path,1) IS NULL THEN RETURN val; END IF;
 IF array_length(path,1)=1 THEN RETURN jsonb_set(COALESCE(doc,'{}'::jsonb),path,val,true); END IF;
 child := doc #> ARRAY[path[1]];
 IF child IS NULL OR child='null'::jsonb THEN
  child := CASE WHEN path[2] ~ '^[0-9]+$' THEN '[]'::jsonb ELSE '{}'::jsonb END;
 END IF;
 RETURN jsonb_set(COALESCE(doc,'{}'::jsonb),ARRAY[path[1]],ed_set_inner(child,path[2:],val),true);
END $$;
