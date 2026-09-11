-- PostgreSQL implementations for versioned, text-encoded document columns.
-- Keep text column representation for immutable quote snapshots and legacy imports.
CREATE OR REPLACE FUNCTION ed_path(path text) RETURNS text[] LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT string_to_array(trim(leading '.' from regexp_replace(substr(path,2),'\[([0-9]+)\]','.\1','g')),'.')
$$;
CREATE OR REPLACE FUNCTION ed_text(doc text, path text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE jsonb_typeof(doc::jsonb #> ed_path(path))
 WHEN 'boolean' THEN CASE WHEN (doc::jsonb #>> ed_path(path))='true' THEN '1' ELSE '0' END
 WHEN 'null' THEN NULL ELSE doc::jsonb #>> ed_path(path) END
$$;
CREATE OR REPLACE FUNCTION ed_number(doc text, path text) RETURNS numeric LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT ed_text(doc,path)::numeric
$$;
CREATE OR REPLACE FUNCTION ed_json(doc text) RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT doc::jsonb $$;
CREATE OR REPLACE FUNCTION ed_array_length(doc text) RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT jsonb_array_length(doc::jsonb) $$;
CREATE OR REPLACE FUNCTION ed_each(doc text) RETURNS TABLE(key text,value text) LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT (ordinality-1)::text, CASE jsonb_typeof(v) WHEN 'string' THEN v #>> '{}' ELSE v::text END
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(doc::jsonb)='array' THEN doc::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY a(v,ordinality)
 UNION ALL
 SELECT k, CASE jsonb_typeof(v) WHEN 'string' THEN v #>> '{}' ELSE v::text END
 FROM jsonb_each(CASE WHEN jsonb_typeof(doc::jsonb)='object' THEN doc::jsonb ELSE '{}'::jsonb END) a(k,v)
$$;
CREATE OR REPLACE FUNCTION ed_set_inner(doc jsonb, path text[], val jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE child jsonb;
BEGIN
 IF array_length(path,1) IS NULL THEN RETURN val; END IF;
 IF array_length(path,1)=1 THEN RETURN jsonb_set(COALESCE(doc,'{}'::jsonb),path,val,true); END IF;
 child := doc -> path[1];
 IF child IS NULL OR child='null'::jsonb THEN
  child := CASE WHEN path[2] ~ '^[0-9]+$' THEN '[]'::jsonb ELSE '{}'::jsonb END;
 END IF;
 RETURN jsonb_set(COALESCE(doc,'{}'::jsonb),ARRAY[path[1]],ed_set_inner(child,path[2:],val),true);
END $$;
CREATE OR REPLACE FUNCTION ed_set(doc text,path text,val jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ed_set_inner(doc::jsonb,ed_path(path),COALESCE(val,'null'::jsonb))::text $$;
CREATE OR REPLACE FUNCTION ed_set(doc text,path text,val text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ed_set(doc,path,to_jsonb(val)) $$;
CREATE OR REPLACE FUNCTION ed_patch_inner(doc jsonb, patch jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; v jsonb; result jsonb;
BEGIN
 IF jsonb_typeof(patch)!='object' THEN RETURN patch; END IF;
 result := CASE WHEN jsonb_typeof(doc)='object' THEN doc ELSE '{}'::jsonb END;
 FOR k,v IN SELECT * FROM jsonb_each(patch) LOOP
  IF v='null'::jsonb THEN result := result-k;
  ELSE result := jsonb_set(result,ARRAY[k],ed_patch_inner(result->k,v),true); END IF;
 END LOOP;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION ed_patch(doc text,patch text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ed_patch_inner(doc::jsonb,patch::jsonb)::text $$;
CREATE OR REPLACE FUNCTION ed_patch(doc text,patch jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ed_patch_inner(doc::jsonb,patch)::text $$;
CREATE OR REPLACE FUNCTION ed_julian(stamp text) RETURNS double precision LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT EXTRACT(EPOCH FROM stamp::timestamp)/86400.0+2440587.5 $$;
CREATE OR REPLACE FUNCTION ed_raise(message text) RETURNS integer LANGUAGE plpgsql VOLATILE AS $$ BEGIN RAISE EXCEPTION USING MESSAGE=message, ERRCODE='P0001'; END $$;
