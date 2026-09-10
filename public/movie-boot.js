import {showMovieOpening} from './movie-opening.js';
import {shouldShowOpening} from './opening-route.js';
let seen=false;
try{seen=!!sessionStorage.getItem('mystery.opening-seen');}catch{}
if(shouldShowOpening(location.search,seen)){
  showMovieOpening(pathway=>{const url=new URL(location.href);url.searchParams.set('path',pathway);location.assign(url);});
}
