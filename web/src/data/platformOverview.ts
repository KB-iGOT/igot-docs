/* Data for the Platform Overview page's layer diagram: the columns (left → right, the way a request
   travels), the colour-coded groups inside them, every component, and who talks to whom.
   Moved unchanged from the former standalone igot-architecture-overview.html. */

export type GroupId = 'clients' | 'gateway' | 'igot' | 'knowlg' | 'lern' | 'live' | 'msg' | 'ana' | 'ext';

export interface Column { id: string; n: string; name: string; tag: string; groups: GroupId[] }
export interface Group { name: string; sub?: string; color: string; soft: string; blurb: string }
export interface Node { id: string; layer: GroupId; label: string; sub?: string; owns: string; repo?: string; b?: boolean }

export const COLUMNS: Column[] = [
  {id:'clients',  n:'1', name:'Web portals & mobile', tag:'people',           groups:['clients']},
  {id:'gateway',  n:'2', name:'Proxies & gateways',   tag:'two front doors',  groups:['gateway']},
  {id:'services', n:'3', name:'Services',             tag:'iGOT + Sunbird Knowlg + Lern', groups:['igot','knowlg','lern']},
  {id:'data',     n:'4', name:'Data & messaging',     tag:'stores · events',   groups:['live','msg','ana']},
  {id:'ext',      n:'→', name:'External systems',     tag:'outside the boundary', groups:['ext']}
];
export const GROUPS: Record<GroupId, Group> = {
  clients:{name:'Web portals & mobile', color:'#EF951E', soft:'#FDF1E0', blurb:'The screens civil servants, department (MDO) admins, SPV super-admins and content creators actually use: four web portals and the mobile app. Nothing here talks to a service directly — every call goes through the gateway layer.'},
  gateway:{name:'Proxies & gateways', color:'#4E5562', soft:'#F0F1F4', blurb:'One public host. Nginx splits traffic onto two front doors — /apis (UI Proxy: browser session, Keycloak token exchange, allow-list) and /api (Kong: the authoritative public-URI → service route map). Keycloak is the single identity provider.'},
  igot:{name:'iGOT services', sub:'Karmayogi Bharat', color:'#1B4CA1', soft:'#E8EEF9', blurb:'Everything that makes iGOT iGOT rather than a generic Sunbird deployment — registration and approvals, organisation hierarchy, competencies, karma points, communities, the partner marketplace, notifications, the nightly analytics pipeline and the AI assistants. Built beside the Sunbird core, calling into it where needed.'},
  knowlg:{name:'Sunbird Knowlg', sub:'knowledge building block · upstream', color:'#0F7A5E', soft:'#E6F4EF', blurb:'Sunbird\'s knowledge building block (knowlg.sunbird.org): content and its lifecycle, composite search, taxonomy / framework, DIAL, players and editors, and the Flink jobs that publish and index. Consumed as-is, never forked.'},
  lern:{name:'Sunbird Lern', sub:'learning building block · upstream', color:'#B45309', soft:'#FDF3E7', blurb:'Sunbird\'s learning building block (lern.sunbird.org): user and organisation management, course batches, enrolments and progress, certificates, notifications. Consumed as-is, never forked.'},
  live:{name:'Live stores', color:'#5B6472', soft:'#EEF0F4', blurb:'Polyglot persistence — each store does one job.'},
  msg:{name:'Messaging', color:'#7B3FA0', soft:'#F3ECF8', blurb:'The Kafka backbone: services react to each other\'s events instead of calling each other.'},
  ana:{name:'Analytics stores', color:'#0E7490', soft:'#E6F4F7', blurb:'Written nightly by cb-core-data, read by BI.'},
  ext:{name:'External systems', color:'#C8933A', soft:'#FDF1E0', blurb:'Systems outside the platform boundary that iGOT integrates with.'}
};
export const COLBLURB: Partial<Record<string, string>> = {
  services:'Behind Kong three service families sit side by side: iGOT services (Karmayogi Bharat) and the two upstream Sunbird building blocks — Knowlg (content, search, taxonomy) and Lern (users, orgs, courses, certificates). Kong routes to any of them directly; where iGOT needs core behaviour it calls the Sunbird blocks sideways — it extends them, never forks them.',
  data:'Three kinds of state: the live stores the services read and write, the Kafka backbone that carries their events, and the analytics stores filled nightly by cb-core-data and read by BI.'
};

export const NODES: Node[] = [
  {id:'portal',     layer:'clients', label:'Learner web', sub:'sunbird-cb-portal', owns:'Learner-facing web portal', repo:'sunbird-cb-portal'},
  {id:'mobile',     layer:'clients', label:'Mobile app', sub:'igot_karmayogi_mobile', owns:'Learner mobile app (Android / iOS)', repo:'igot_karmayogi_mobile'},
  {id:'orgportal',  layer:'clients', label:'MDO admin', sub:'sunbird-cb-orgportal', owns:'Department (MDO) admin portal', repo:'sunbird-cb-orgportal'},
  {id:'adminportal',layer:'clients', label:'SPV / super admin', sub:'sunbird-cb-adminportal', owns:'SPV super-admin portal', repo:'sunbird-cb-adminportal'},
  {id:'creation',   layer:'clients', label:'Creation portal', sub:'sunbird-cb-creationportal', owns:'Content authoring and review portal', repo:'sunbird-cb-creationportal'},

  {id:'nginx',   layer:'gateway', label:'Nginx', sub:'edge', owns:'TLS termination; splits /apis → UI Proxy and /api → Kong'},
  {id:'uiproxy', layer:'gateway', label:'UI Proxy', sub:'sunbird-cb-uiproxy · /apis', owns:'Browser session, Keycloak token exchange, allow-listed /apis routes. Most requests are forwarded to Kong; a few routes (competency, FRAC) go straight to iGOT services', repo:'sunbird-cb-uiproxy'},
  {id:'kong',    layer:'gateway', label:'Kong API gateway', sub:'/api', owns:'Public URI → internal service map (sunbird-devops › kong-api), JWT / CORS / ACL plugins. Routes to iGOT, Knowlg and Lern services alike', repo:'sunbird-devops'},
  {id:'keycloak',layer:'gateway', label:'Keycloak', sub:'identity · SSO', owns:'Identity, login theme, realms, SSO clients (incl. marketplace partner SSO)', repo:'sunbird-devops'},

  {id:'cbext',   layer:'igot', label:'sunbird-cb-ext', sub:'registration · org · profile · karma', owns:'Registration orchestration, custom links, org creation/hierarchy, profile, karma points, competency-designation mapping, search-by directory', repo:'sunbird-cb-ext'},
  {id:'cbcourse',layer:'igot', label:'cb-ext-course-service', sub:'course extensions', owns:'Karmayogi-specific course / enrolment extensions', repo:'cb-ext-course-service'},
  {id:'workflow',layer:'igot', label:'sunbird-cb-workflow', sub:'approvals', owns:'Approval workflows: user registration, domain, organisation, position, blended-program enrolment', repo:'sunbird-cb-workflow'},
  {id:'frac',    layer:'igot', label:'frac-backend', sub:'competency taxonomy', owns:'FRAC competency taxonomy (parallel to the knowledge-platform framework)', repo:'frac-backend'},
  {id:'disc',    layer:'igot', label:'Discussion & community', sub:'cb-discussion · cb-community · cb-comment', owns:'cb-discussion-service, cb-community-service, cb-comment-service, meta-update consumers; language detection & profanity via ML sidecar', repo:'cb-discussion-service'},
  {id:'market',  layer:'igot', label:'Marketplace', sub:'cb-pores · cios-content · external-enrollment', owns:'cb-pores-service (partner master), cios-content-service (catalog ETL, partner sync), cb_external_enrollment_service (enrolment, licence limits)', repo:'cb-pores-service'},
  {id:'notif',   layer:'igot', label:'notification-service', sub:'+ wrapper', owns:'Email / notification dispatch, with cb-notification-wrapper-service in front', repo:'notification-service'},
  {id:'ai',      layer:'igot', label:'AI services', sub:'nlp-search · ai-assessment · profanity', owns:'nlp-search keyword extraction, ai-assessment-service, AI CBP authoring, profanity model — opt-in per client', repo:'nlp-search'},
  {id:'coredata',layer:'igot', label:'cb-core-data', sub:'nightly Spark · DuckDB', owns:'Nightly Spark / DuckDB stages: extract → pre-join → ~46 reports, warehouse, cache, karma, leaderboards', repo:'cb-core-data'},

  {id:'kp',    layer:'knowlg', label:'knowledge-platform', sub:'content · search · taxonomy', owns:'content-service (Draft → Review → Live), search-service (composite search over Elasticsearch), taxonomy / framework API', repo:'knowledge-platform'},
  {id:'kmw',   layer:'knowlg', label:'knowledge-mw-service', sub:'legacy middleware relay', owns:'Node middleware in front of the knowledge platform: relays the legacy v1 composite search and content proxies to the current services (knowledge-mw-service:5000 in the Kong route map)', repo:'knowledge-mw-service'},
  {id:'lms',   layer:'lern', label:'sunbird-lms-service', sub:'users · orgs · roles · OTP', owns:'Lern user-org service: user accounts, organisations, roles, OTP, SSO user creation', repo:'sunbird-lms-service'},
  {id:'course',layer:'lern', label:'sunbird-course-service', sub:'batches · enrolments · progress', owns:'Lern course service: batches, enrolments, content-state progress, external-course enrolment path', repo:'sunbird-course-service'},
  {id:'kpjobs',layer:'knowlg', label:'knowledge-platform-jobs', sub:'Flink: indexer · publish', owns:'Knowlg Flink jobs: search indexer, content publish pipeline', repo:'knowledge-platform-jobs'},
  {id:'assess',layer:'knowlg', label:'assessment-service', sub:'Sunbird inQuiry · contracts only', owns:'Assessment shell, questions, save/submit, result. Upstream this is Sunbird\'s inQuiry building block; shown with Knowlg here — contracts only', b:true},
  {id:'cert',  layer:'lern', label:'certificates / registry', sub:'contracts only', owns:'Lern certificate generation on completion events — contracts and Kafka topics only', b:true},

  {id:'cassandra', layer:'live', label:'Cassandra', sub:'transactional', owns:'Transactional state: users, orgs, batches, enrolments, progress, karma, leaderboards'},
  {id:'es',        layer:'live', label:'Elasticsearch', sub:'search · directory', owns:'Search and directory indexes: compositesearch (content), user/org directory, marketplace catalog'},
  {id:'postgres',  layer:'live', label:'Postgres', sub:'workflow · marketplace', owns:'Relational data: workflow, FRAC taxonomy, marketplace partner records, config'},
  {id:'redis',     layer:'live', label:'Redis', sub:'cache · counters', owns:'Cache, counters, live-dashboard keys, enrolment limit counters'},
  {id:'neo4j',     layer:'live', label:'Neo4j', sub:'content graph', owns:'Content and framework graph behind knowledge-platform'},
  {id:'mongo',     layer:'live', label:'MongoDB', sub:'owner not traced', owns:'Read as a Stage-2 source by cb-core-data; the writing owner is not traced in this doc set', b:true},
  {id:'gcs',       layer:'live', label:'GCS', sub:'content · exports', owns:'Content assets, bulk-upload files, password-protected report exports'},
  {id:'kafka',     layer:'msg',  label:'Kafka', sub:'event backbone', owns:'Event backbone: enrolment, completion, registration, karma, publish, telemetry topics'},
  {id:'warehouse', layer:'ana',  label:'Postgres warehouse', sub:'12 BI tables', owns:'12 core BI tables, full truncate-and-reload every night'},
  {id:'bigquery',  layer:'ana',  label:'BigQuery', sub:'mirror', owns:'Mirror of the warehouse for Looker; destructive replace every run'},
  {id:'druid',     layer:'ana',  label:'Druid', sub:'telemetry OLAP', owns:'Telemetry OLAP, named as a Stage-2 source; the ingestion path is not traced', b:true},

  {id:'x_partner', layer:'ext', label:'Partner LMSs', sub:'Coursera · Cornell · CDAC · Harvard', owns:'Catalog sync and enrolment with partner platforms'},
  {id:'x_gemini',  layer:'ext', label:'Gemini · Vertex AI', sub:'Google AI APIs', owns:'Google AI APIs behind the AI services'},
  {id:'x_looker',  layer:'ext', label:'Looker / BI', sub:'dashboards', owns:'BI dashboards reading the warehouse and BigQuery'},
  {id:'x_mail',    layer:'ext', label:'Email / SMS', sub:'providers · not traced', owns:'Delivery providers behind notification-service — not traced', b:true}
];

export const LINKS: [string, string][] = [
  ['kp','neo4j'],['kp','es'],['kp','cassandra'],['kp','redis'],['kp','kafka'],
  ['lms','cassandra'],['lms','es'],['lms','kafka'],
  ['course','cassandra'],['course','redis'],['course','kafka'],
  ['kpjobs','kafka'],['kpjobs','es'],['kpjobs','neo4j'],['cert','kafka'],
  ['cbext','cassandra'],['cbext','es'],['cbext','redis'],['cbext','postgres'],['cbext','kafka'],
  ['cbcourse','cassandra'],['cbcourse','redis'],['cbcourse','kafka'],
  ['workflow','postgres'],['workflow','kafka'],['frac','postgres'],
  ['disc','cassandra'],['disc','es'],['disc','kafka'],
  ['market','postgres'],['market','es'],['market','cassandra'],['market','redis'],['market','gcs'],['market','kafka'],
  ['notif','kafka'],
  ['coredata','cassandra'],['coredata','es'],['coredata','postgres'],['coredata','mongo'],['coredata','druid'],['coredata','redis'],['coredata','gcs'],['coredata','warehouse'],['coredata','bigquery'],
  ['cbext','lms'],['cbext','kp'],['cbcourse','course'],['market','course'],['coredata','kp'],['ai','kp'],
  ['kong','cbext'],['kong','cbcourse'],['kong','workflow'],['kong','frac'],['kong','disc'],['kong','market'],['kong','notif'],['kong','ai'],
  ['kong','kp'],['kong','kmw'],['kmw','kp'],['kong','lms'],['kong','course'],['kong','assess'],
  ['nginx','uiproxy'],['nginx','kong'],['uiproxy','kong'],['uiproxy','keycloak'],['keycloak','lms'],
  ['uiproxy','cbext'],['uiproxy','frac'],
  ['portal','nginx'],['mobile','nginx'],['orgportal','nginx'],['adminportal','nginx'],['creation','nginx'],
  ['portal','keycloak'],['mobile','keycloak'],['orgportal','keycloak'],['adminportal','keycloak'],['creation','keycloak'],
  ['market','x_partner'],['ai','x_gemini'],['warehouse','x_looker'],['bigquery','x_looker'],['notif','x_mail']
];

/** order of the related-component groups in the detail card */
export const GORDER: GroupId[] = ['clients','gateway','igot','knowlg','lern','live','msg','ana','ext'];
