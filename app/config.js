// Configuração da IA. A "anon key" do Supabase é pública por natureza (vai no app);
// a chave da Anthropic NUNCA vai aqui (fica nos Secrets do Supabase).
window.LAY_CONFIG = {
  iaUrl: 'https://jfnvfgrcrmgppfedkekj.supabase.co/functions/v1/interpretar-prato',
  whatsapp: '',       // número da Layane com DDI e DDD, ex.: '5593999999999' (aparece o botão "Falar com a Layane")
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmbnZmZ3Jjcm1ncHBmZWRrZWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTIyMTcsImV4cCI6MjEwNzgyODIxN30.zjhSI5lozvFSyMOEs9hjLLSOBDoJaAwDTLsJXRZU1NA'
};
