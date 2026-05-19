import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!);
supabase.from('report_templates').select('report_template_config_json, report_template_setup_json').eq('report_template_id', 'a3591f17-22ce-4d07-bf09-ac8d2a4f8823').single().then(r => {
  console.log("report_columns:");
  console.log(JSON.stringify(r.data?.report_template_config_json?.report_columns, null, 2));
  console.log("tables:");
  console.log(JSON.stringify(r.data?.report_template_setup_json?.tables, null, 2));
});
