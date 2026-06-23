import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iixxaaeurdcyuvouqzlz.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHhhYWV1cmRjeXV2b3Vxemx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDcwMjEsImV4cCI6MjA5NzEyMzAyMX0.ucwKGqn_8FiCnrSdPpB7A-zWOntPIbDiagyh8RF9owc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
