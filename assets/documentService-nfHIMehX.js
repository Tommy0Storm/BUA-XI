async function u(s){try{const o=await fetch("/documents/lra-code-of-conduct-dismissals-2025.txt");if(!o.ok)throw new Error("Document not found");const c=await o.text(),r=s.toLowerCase(),n=c.split(`
`),e=[];for(let t=0;t<n.length;t++)if(n[t].toLowerCase().includes(r)){const a=Math.max(0,t-2),i=Math.min(n.length,t+3);if(e.push(n.slice(a,i).join(`
`)),e.length>=3)break}return e.length>0?e.join(`

---

`):"No relevant sections found in LRA document."}catch{return"Unable to access the LRA document at this time."}}export{u as queryLRADocument};
