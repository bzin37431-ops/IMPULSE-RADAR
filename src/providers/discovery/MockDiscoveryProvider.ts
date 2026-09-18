import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
const descriptors = ['Performance','Prime','Atlas','Strong','Vale','Movimento','Evolução','Central','Viva','Equilíbrio','Norte','Sul','Arena','Essencial','Avançada','360','Conquista','Horizonte','Conexão','Pleno'];
const aliases: Record<string,string[]> = { academia:['academia','fitness','treinamento','musculação','crossfit','pilates','yoga'], barbearia:['barbearia','barber','corte masculino'], 'salão de beleza':['salão','beleza','cabeleireiro','cabelos'], restaurante:['restaurante','gastronomia','cozinha'], 'clínica de estética':['estética','beleza','dermatologia'], dentista:['odontologia','dentista','odonto'], advocacia:['advocacia','advogado','jurídico'] };
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function familyFor(niche:string){const normalized=normalize(niche);const key=Object.keys(aliases).find(item=>normalized.includes(normalize(item)));return {label:niche,terms:key?aliases[key]:[niche]};}
export class MockDiscoveryProvider implements DiscoveryProvider {
  constructor(private providerName='MOCK_DISCOVERY') {}
  getProviderName(){return this.providerName;}
  supportsLocation(){return true;}
  getRateLimitInfo(){return {configured:true,requestsPerMinute:120};}
  async searchBusinesses(query:DiscoveryQuery):Promise<DiscoveryBusiness[]> { const family=familyFor(query.niche); return Array.from({length:Math.min(query.quantity,500)},(_,index)=>{const descriptor=descriptors[index%descriptors.length];const name=family.label+' '+descriptor;return {externalIds:{mock:normalize(family.label)+'-'+index},name,category:family.label,city:query.city,state:query.state,district:query.district&&query.district!=='Toda a cidade'?query.district:(index%2?'Centro':'Jardim Aquarius'),latitude:-23.22+(index%20)*.002,longitude:-45.95+(index%20)*.002,address:'Localização de demonstração '+(index+1)};}); }
}
