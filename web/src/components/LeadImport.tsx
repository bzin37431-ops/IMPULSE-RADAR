import React,{useRef,useState}from'react';
import{post}from'../services/api';
import{ToastState}from'./Toast';

export function LeadImport({refresh,notify}:{refresh:()=>void;notify:(toast:ToastState)=>void}){
 const input=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);
 const parse=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const lines=(await file.text()).split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('O CSV precisa ter cabeçalho e pelo menos uma linha.');const headers=lines[0].split(',').map(x=>x.trim().toLowerCase());const rows=lines.slice(1).map(line=>{const values=line.split(',').map(x=>x.trim().replace(/^"|"$/g,''));const row:Record<string,string>={};headers.forEach((h,i)=>row[h]=values[i]||'');return{name:row.nome||row.name,company:row.empresa||row.company,phone:row.telefone||row.phone,city:row.cidade||row.city,state:row.estado||row.state,niche:row.nicho||row.niche,instagram:row.instagram,site:row.site,observations:row.observacoes||row.observations}}).filter(x=>x.name);const result:any=await post('/api/leads/import',{rows});notify({kind:'success',title:'Importação concluída',description:`${result.imported} importados · ${result.duplicates} duplicados`});refresh()}catch(error:any){notify({kind:'error',title:'CSV não importado',description:error.message})}finally{setBusy(false);if(input.current)input.current.value=''}};
 return <label className="ghost import-control">{busy?'Importando…':'Importar CSV'}<input ref={input} type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={parse}/></label>;
}
