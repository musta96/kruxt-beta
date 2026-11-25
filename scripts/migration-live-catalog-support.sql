begin isolation level repeatable read read only;
set local search_path = pg_catalog;
with objects(kind, identity, definition) as (
  select 'relation', format('%I.%I', n.nspname, c.relname),
    jsonb_build_object('kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
      'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
      'acl', c.relacl::text, 'options', c.reloptions,
      'persistence', c.relpersistence, 'replicaIdentity', c.relreplident,
      'view', case when c.relkind in ('v','m') then pg_get_viewdef(c.oid, false) end)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('auth','kruxt_private') and c.relkind in ('r','p','v','m','S','f')
  union all
  select 'column', format('%I.%I.%I', n.nspname, c.relname, a.attname),
    jsonb_build_object('position', a.attnum, 'type', format_type(a.atttypid,a.atttypmod),
      'notNull', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid), 'acl', a.attacl::text,
      'collation', case when co.oid is not null then format('%I.%I', cn.nspname,co.collname) end)
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  left join pg_collation co on co.oid = a.attcollation
  left join pg_namespace cn on cn.oid = co.collnamespace
  where n.nspname in ('auth','kruxt_private') and a.attnum > 0 and not a.attisdropped
    and c.relkind in ('r','p','v','m','f')
  union all
  select 'constraint', format('%I.%I.%I', n.nspname,c.relname,k.conname),
    jsonb_build_object('sql', pg_get_constraintdef(k.oid,false), 'validated', k.convalidated)
  from pg_constraint k join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth','kruxt_private')
  union all
  select 'index', format('%I.%I', n.nspname,c.relname),
    jsonb_build_object('sql',pg_get_indexdef(i.indexrelid), 'valid',i.indisvalid,'ready',i.indisready)
  from pg_index i join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth','kruxt_private')
  union all
  select 'routine', format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),
    jsonb_build_object('sql',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),
      'acl',p.proacl::text,'securityDefiner',p.prosecdef,'config',p.proconfig)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('auth','kruxt_private') and p.prokind in ('f','p','w')
  union all
  select 'policy', format('%I.%I.%I',n.nspname,c.relname,p.polname),
    jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
      'roles',(select jsonb_agg(case when r = 0 then 'PUBLIC' else pg_get_userbyid(r) end order by r)
               from unnest(p.polroles) r),
      'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))
  from pg_policy p join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth','kruxt_private')
  union all
  select 'trigger',format('%I.%I.%I',n.nspname,c.relname,t.tgname),
    jsonb_build_object('sql',pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('auth','kruxt_private') and not t.tgisinternal
  union all
  select 'enum',format('%I.%I',n.nspname,t.typname),
    jsonb_agg(e.enumlabel order by e.enumsortorder)
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid where n.nspname in ('auth','kruxt_private')
  group by n.nspname,t.typname
  union all
  select 'schema',n.nspname,jsonb_build_object('owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text)
  from pg_namespace n where n.nspname in ('auth','kruxt_private')
  union all
  select 'defaultAcl',format('%s/%s/%s',pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'*'),d.defaclobjtype),
    to_jsonb(d.defaclacl::text)
  from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname in ('auth','kruxt_private') or d.defaclnamespace = 0
  union all
  select 'role',r.rolname,jsonb_build_object('superuser',r.rolsuper,'inherit',r.rolinherit,
    'bypassRls',r.rolbypassrls,'login',r.rolcanlogin,'config',r.rolconfig)
  from pg_roles r
  union all
  select 'roleMembership',format('%s/%s/%s',pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor)),
    jsonb_build_object('admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
  from pg_auth_members m
  union all
  select 'extension',e.extname,jsonb_build_object('version',e.extversion,'schema',n.nspname)
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
), payload as (
  select jsonb_agg(jsonb_build_object('kind',kind,'identity',identity,'definition',definition)
    order by kind collate "C",identity collate "C") as objects from objects
)
select to_char(transaction_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as captured_at,
current_setting('server_version') as server_version, current_setting('transaction_read_only') as transaction_read_only,
encode(sha256(convert_to(objects::text,'UTF8')),'hex') as catalog_sha256,
       objects as catalog_objects from payload;

rollback;
