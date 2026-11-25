begin isolation level repeatable read read only;
set local search_path = pg_catalog;
select jsonb_build_object(
'capturedAt', to_char(transaction_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
'projectRef','hgomsmhsybrxjdxbgkjy',
'sequences',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'type',format_type(s.seqtypid,null),'start',s.seqstart::text,'increment',s.seqincrement::text,'minimum',s.seqmin::text,'maximum',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) order by n.nspname,c.relname),'[]'::jsonb) from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage')),
'domains',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'base',format_type(t.typbasetype,t.typtypmod),'notNull',t.typnotnull,'default',t.typdefault) order by n.nspname,t.typname),'[]'::jsonb) from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype='d' and n.nspname in ('public','auth','storage')),
'partitions',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'partitionKey',case when c.relkind='p' then pg_get_partkeydef(c.oid) end,'bound',pg_get_expr(c.relpartbound,c.oid)) order by n.nspname,c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') and (c.relkind='p' or c.relispartition)),
'eventTriggers',(select coalesce(jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'function',evtfoid::regprocedure::text,'tags',evttags) order by evtname),'[]'::jsonb) from pg_event_trigger),
'crossSchemaDependencies',(select coalesce(jsonb_agg(jsonb_build_object('dependent',pg_describe_object(d.classid,d.objid,d.objsubid),'referenced',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype) order by pg_describe_object(d.classid,d.objid,d.objsubid),pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),d.deptype),'[]'::jsonb)
 from pg_depend d
 cross join lateral pg_identify_object(d.classid,d.objid,d.objsubid) dep
 cross join lateral pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) ref
 where dep.schema='public' and ref.schema is not null and ref.schema not in ('public','pg_catalog')),
'buckets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id),'[]'::jsonb) from storage.buckets)
) as restore_metadata;
rollback;
