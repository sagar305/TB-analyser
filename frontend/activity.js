// Milestones for the page that frames this app on setutechnology.com.
//
// When the app is opened inside that page, it tells the page that a step was
// reached: "sample loaded", "review pack exported". It says so with a browser
// event on the parent window and nothing else. This file makes no network
// call (the page's CSP has connect-src 'none' regardless), and a signal is a
// fixed product id and one name from the list below. There is no argument a
// figure, an account name or a file name could travel in.
//
// Opened on its own, from localhost or from a file, there is no parent page
// and this does nothing at all.
export const milestones=['sample_loaded','template_downloaded','periods_imported','cash_flow_saved','excel_exported','pdf_exported'];
export function announce(name,host=globalThis){
  if(!milestones.includes(name))return false;
  try{
    const parent=host.parent;
    if(!parent||parent===host)return false;
    // A parent on another origin throws here, which is the right outcome: only
    // the site that serves this app under its own domain is told anything.
    parent.dispatchEvent(new parent.CustomEvent('setu:activity',{detail:{product:'tb',name}}));
    return true;
  }catch{return false;}
}
