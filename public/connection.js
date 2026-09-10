document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault();const button=document.querySelector('button'), input=document.querySelector('input'), status=document.querySelector('#status');
  button.disabled=true;status.textContent='Connecting…';
  try{const response=await fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:input.value})});const body=await response.json();if(!response.ok)throw Error(body.error);input.value='';status.textContent='Connected. Your studio is ready.';}
  catch(error){status.textContent=error.message||'Could not connect. Try again.';}finally{button.disabled=false;}
});
