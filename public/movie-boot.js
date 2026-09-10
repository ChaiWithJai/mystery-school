import {showMovieOpening} from './movie-opening.js';
if(!sessionStorage.getItem('mystery.opening-seen')&&!new URLSearchParams(location.search).has('artifact')){
  showMovieOpening(pathway=>{const url=new URL(location.href);url.searchParams.set('path',pathway);location.assign(url);});
}
