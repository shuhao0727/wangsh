(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Pa="180",gi={ROTATE:0,DOLLY:1,PAN:2},pi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},xl=0,ao=1,Ml=2,Sc=1,Ec=2,pn=3,Pn=0,Ct=1,mn=2,Rn=0,_i=1,oo=2,co=3,lo=4,yl=5,Gn=100,Sl=101,El=102,Tl=103,bl=104,Al=200,wl=201,Rl=202,Cl=203,zr=204,kr=205,Pl=206,Dl=207,Ll=208,Il=209,Nl=210,Ul=211,Fl=212,Ol=213,Bl=214,Hr=0,Gr=1,Vr=2,Mi=3,Wr=4,Xr=5,qr=6,$r=7,Tc=0,zl=1,kl=2,Cn=0,Hl=1,Gl=2,Vl=3,bc=4,Wl=5,Xl=6,ql=7,Ac=300,yi=301,Si=302,Yr=303,jr=304,Xs=306,Kr=1e3,Wn=1001,Zr=1002,Yt=1003,$l=1004,rs=1005,tn=1006,ir=1007,Xn=1008,an=1009,wc=1010,Rc=1011,qi=1012,Da=1013,qn=1014,gn=1015,es=1016,La=1017,Ia=1018,$i=1020,Cc=35902,Pc=35899,Dc=1021,Lc=1022,Xt=1023,Yi=1026,ji=1027,Ic=1028,Na=1029,Nc=1030,Ua=1031,Fa=1033,Ls=33776,Is=33777,Ns=33778,Us=33779,Jr=35840,Qr=35841,ea=35842,ta=35843,na=36196,ia=37492,sa=37496,ra=37808,aa=37809,oa=37810,ca=37811,la=37812,ua=37813,ha=37814,da=37815,fa=37816,pa=37817,ma=37818,ga=37819,_a=37820,va=37821,xa=36492,Ma=36494,ya=36495,Sa=36283,Ea=36284,Ta=36285,ba=36286,Yl=3200,jl=3201,Uc=0,Kl=1,wn="",Nt="srgb",Ei="srgb-linear",zs="linear",Ze="srgb",Qn=7680,uo=519,Zl=512,Jl=513,Ql=514,Fc=515,eu=516,tu=517,nu=518,iu=519,ho=35044,fo="300 es",nn=2e3,ks=2001;class Kn{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const yt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let po=1234567;const Wi=Math.PI/180,Ki=180/Math.PI;function bi(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(yt[i&255]+yt[i>>8&255]+yt[i>>16&255]+yt[i>>24&255]+"-"+yt[e&255]+yt[e>>8&255]+"-"+yt[e>>16&15|64]+yt[e>>24&255]+"-"+yt[t&63|128]+yt[t>>8&255]+"-"+yt[t>>16&255]+yt[t>>24&255]+yt[n&255]+yt[n>>8&255]+yt[n>>16&255]+yt[n>>24&255]).toLowerCase()}function ze(i,e,t){return Math.max(e,Math.min(t,i))}function Oa(i,e){return(i%e+e)%e}function su(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function ru(i,e,t){return i!==e?(t-i)/(e-i):0}function Xi(i,e,t){return(1-t)*i+t*e}function au(i,e,t,n){return Xi(i,e,1-Math.exp(-t*n))}function ou(i,e=1){return e-Math.abs(Oa(i,e*2)-e)}function cu(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function lu(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function uu(i,e){return i+Math.floor(Math.random()*(e-i+1))}function hu(i,e){return i+Math.random()*(e-i)}function du(i){return i*(.5-Math.random())}function fu(i){i!==void 0&&(po=i);let e=po+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function pu(i){return i*Wi}function mu(i){return i*Ki}function gu(i){return(i&i-1)===0&&i!==0}function _u(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function vu(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function xu(i,e,t,n,s){const r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+n)/2),d=a((e+n)/2),h=r((e-n)/2),p=a((e-n)/2),m=r((n-e)/2),v=a((n-e)/2);switch(s){case"XYX":i.set(o*d,l*h,l*p,o*c);break;case"YZY":i.set(l*p,o*d,l*h,o*c);break;case"ZXZ":i.set(l*h,l*p,o*d,o*c);break;case"XZX":i.set(o*d,l*v,l*m,o*c);break;case"YXY":i.set(l*m,o*d,l*v,o*c);break;case"ZYZ":i.set(l*v,l*m,o*d,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function fi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Tt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const Hs={DEG2RAD:Wi,RAD2DEG:Ki,generateUUID:bi,clamp:ze,euclideanModulo:Oa,mapLinear:su,inverseLerp:ru,lerp:Xi,damp:au,pingpong:ou,smoothstep:cu,smootherstep:lu,randInt:uu,randFloat:hu,randFloatSpread:du,seededRandom:fu,degToRad:pu,radToDeg:mu,isPowerOfTwo:gu,ceilPowerOfTwo:_u,floorPowerOfTwo:vu,setQuaternionFromProperEuler:xu,normalize:Tt,denormalize:fi};class De{constructor(e=0,t=0){De.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=ze(this.x,e.x,t.x),this.y=ze(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=ze(this.x,e,t),this.y=ze(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ze(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(ze(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class $n{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],d=n[s+2],h=n[s+3];const p=r[a+0],m=r[a+1],v=r[a+2],x=r[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=d,e[t+3]=h;return}if(o===1){e[t+0]=p,e[t+1]=m,e[t+2]=v,e[t+3]=x;return}if(h!==x||l!==p||c!==m||d!==v){let g=1-o;const u=l*p+c*m+d*v+h*x,A=u>=0?1:-1,b=1-u*u;if(b>Number.EPSILON){const D=Math.sqrt(b),R=Math.atan2(D,u*A);g=Math.sin(g*R)/D,o=Math.sin(o*R)/D}const E=o*A;if(l=l*g+p*E,c=c*g+m*E,d=d*g+v*E,h=h*g+x*E,g===1-o){const D=1/Math.sqrt(l*l+c*c+d*d+h*h);l*=D,c*=D,d*=D,h*=D}}e[t]=l,e[t+1]=c,e[t+2]=d,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],d=n[s+3],h=r[a],p=r[a+1],m=r[a+2],v=r[a+3];return e[t]=o*v+d*h+l*m-c*p,e[t+1]=l*v+d*p+c*h-o*m,e[t+2]=c*v+d*m+o*p-l*h,e[t+3]=d*v-o*h-l*p-c*m,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),d=o(s/2),h=o(r/2),p=l(n/2),m=l(s/2),v=l(r/2);switch(a){case"XYZ":this._x=p*d*h+c*m*v,this._y=c*m*h-p*d*v,this._z=c*d*v+p*m*h,this._w=c*d*h-p*m*v;break;case"YXZ":this._x=p*d*h+c*m*v,this._y=c*m*h-p*d*v,this._z=c*d*v-p*m*h,this._w=c*d*h+p*m*v;break;case"ZXY":this._x=p*d*h-c*m*v,this._y=c*m*h+p*d*v,this._z=c*d*v+p*m*h,this._w=c*d*h-p*m*v;break;case"ZYX":this._x=p*d*h-c*m*v,this._y=c*m*h+p*d*v,this._z=c*d*v-p*m*h,this._w=c*d*h+p*m*v;break;case"YZX":this._x=p*d*h+c*m*v,this._y=c*m*h+p*d*v,this._z=c*d*v-p*m*h,this._w=c*d*h-p*m*v;break;case"XZY":this._x=p*d*h-c*m*v,this._y=c*m*h-p*d*v,this._z=c*d*v+p*m*h,this._w=c*d*h+p*m*v;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],d=t[6],h=t[10],p=n+o+h;if(p>0){const m=.5/Math.sqrt(p+1);this._w=.25/m,this._x=(d-l)*m,this._y=(r-c)*m,this._z=(a-s)*m}else if(n>o&&n>h){const m=2*Math.sqrt(1+n-o-h);this._w=(d-l)/m,this._x=.25*m,this._y=(s+a)/m,this._z=(r+c)/m}else if(o>h){const m=2*Math.sqrt(1+o-n-h);this._w=(r-c)/m,this._x=(s+a)/m,this._y=.25*m,this._z=(l+d)/m}else{const m=2*Math.sqrt(1+h-n-o);this._w=(a-s)/m,this._x=(r+c)/m,this._y=(l+d)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ze(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,d=t._w;return this._x=n*d+a*o+s*c-r*l,this._y=s*d+a*l+r*o-n*c,this._z=r*d+a*c+n*l-s*o,this._w=a*d-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*e._w+n*e._x+s*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const m=1-t;return this._w=m*a+t*this._w,this._x=m*n+t*this._x,this._y=m*s+t*this._y,this._z=m*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),d=Math.atan2(c,o),h=Math.sin((1-t)*d)/c,p=Math.sin(t*d)/c;return this._w=a*h+this._w*p,this._x=n*h+this._x*p,this._y=s*h+this._y*p,this._z=r*h+this._z*p,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class N{constructor(e=0,t=0,n=0){N.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(mo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(mo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),d=2*(o*t-r*s),h=2*(r*n-a*t);return this.x=t+l*c+a*h-o*d,this.y=n+l*d+o*c-r*h,this.z=s+l*h+r*d-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=ze(this.x,e.x,t.x),this.y=ze(this.y,e.y,t.y),this.z=ze(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=ze(this.x,e,t),this.y=ze(this.y,e,t),this.z=ze(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ze(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return sr.copy(this).projectOnVector(e),this.sub(sr)}reflect(e){return this.sub(sr.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(ze(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const sr=new N,mo=new $n;class Ue{constructor(e,t,n,s,r,a,o,l,c){Ue.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const d=this.elements;return d[0]=e,d[1]=s,d[2]=o,d[3]=t,d[4]=r,d[5]=l,d[6]=n,d[7]=a,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],d=n[4],h=n[7],p=n[2],m=n[5],v=n[8],x=s[0],g=s[3],u=s[6],A=s[1],b=s[4],E=s[7],D=s[2],R=s[5],P=s[8];return r[0]=a*x+o*A+l*D,r[3]=a*g+o*b+l*R,r[6]=a*u+o*E+l*P,r[1]=c*x+d*A+h*D,r[4]=c*g+d*b+h*R,r[7]=c*u+d*E+h*P,r[2]=p*x+m*A+v*D,r[5]=p*g+m*b+v*R,r[8]=p*u+m*E+v*P,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8];return t*a*d-t*o*c-n*r*d+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],h=d*a-o*c,p=o*l-d*r,m=c*r-a*l,v=t*h+n*p+s*m;if(v===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/v;return e[0]=h*x,e[1]=(s*c-d*n)*x,e[2]=(o*n-s*a)*x,e[3]=p*x,e[4]=(d*t-s*l)*x,e[5]=(s*r-o*t)*x,e[6]=m*x,e[7]=(n*l-c*t)*x,e[8]=(a*t-n*r)*x,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(rr.makeScale(e,t)),this}rotate(e){return this.premultiply(rr.makeRotation(-e)),this}translate(e,t){return this.premultiply(rr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const rr=new Ue;function Oc(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Gs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Mu(){const i=Gs("canvas");return i.style.display="block",i}const go={};function Zi(i){i in go||(go[i]=!0,console.warn(i))}function yu(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const _o=new Ue().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),vo=new Ue().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Su(){const i={enabled:!0,workingColorSpace:Ei,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===Ze&&(s.r=_n(s.r),s.g=_n(s.g),s.b=_n(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===Ze&&(s.r=vi(s.r),s.g=vi(s.g),s.b=vi(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===wn?zs:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Zi("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Zi("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Ei]:{primaries:e,whitePoint:n,transfer:zs,toXYZ:_o,fromXYZ:vo,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Nt},outputColorSpaceConfig:{drawingBufferColorSpace:Nt}},[Nt]:{primaries:e,whitePoint:n,transfer:Ze,toXYZ:_o,fromXYZ:vo,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Nt}}}),i}const qe=Su();function _n(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function vi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let ei;class Eu{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{ei===void 0&&(ei=Gs("canvas")),ei.width=e.width,ei.height=e.height;const s=ei.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=ei}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Gs("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=_n(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(_n(t[n]/255)*255):t[n]=_n(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Tu=0;class Ba{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Tu++}),this.uuid=bi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(ar(s[a].image)):r.push(ar(s[a]))}else r=ar(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function ar(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Eu.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let bu=0;const or=new N;class At extends Kn{constructor(e=At.DEFAULT_IMAGE,t=At.DEFAULT_MAPPING,n=Wn,s=Wn,r=tn,a=Xn,o=Xt,l=an,c=At.DEFAULT_ANISOTROPY,d=wn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:bu++}),this.uuid=bi(),this.name="",this.source=new Ba(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new De(0,0),this.repeat=new De(1,1),this.center=new De(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ue,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(or).x}get height(){return this.source.getSize(or).y}get depth(){return this.source.getSize(or).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Ac)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Kr:e.x=e.x-Math.floor(e.x);break;case Wn:e.x=e.x<0?0:1;break;case Zr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Kr:e.y=e.y-Math.floor(e.y);break;case Wn:e.y=e.y<0?0:1;break;case Zr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}At.DEFAULT_IMAGE=null;At.DEFAULT_MAPPING=Ac;At.DEFAULT_ANISOTROPY=1;class ut{constructor(e=0,t=0,n=0,s=1){ut.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],d=l[4],h=l[8],p=l[1],m=l[5],v=l[9],x=l[2],g=l[6],u=l[10];if(Math.abs(d-p)<.01&&Math.abs(h-x)<.01&&Math.abs(v-g)<.01){if(Math.abs(d+p)<.1&&Math.abs(h+x)<.1&&Math.abs(v+g)<.1&&Math.abs(c+m+u-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const b=(c+1)/2,E=(m+1)/2,D=(u+1)/2,R=(d+p)/4,P=(h+x)/4,U=(v+g)/4;return b>E&&b>D?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=R/n,r=P/n):E>D?E<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(E),n=R/s,r=U/s):D<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(D),n=P/r,s=U/r),this.set(n,s,r,t),this}let A=Math.sqrt((g-v)*(g-v)+(h-x)*(h-x)+(p-d)*(p-d));return Math.abs(A)<.001&&(A=1),this.x=(g-v)/A,this.y=(h-x)/A,this.z=(p-d)/A,this.w=Math.acos((c+m+u-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=ze(this.x,e.x,t.x),this.y=ze(this.y,e.y,t.y),this.z=ze(this.z,e.z,t.z),this.w=ze(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=ze(this.x,e,t),this.y=ze(this.y,e,t),this.z=ze(this.z,e,t),this.w=ze(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ze(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Au extends Kn{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:tn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ut(0,0,e,t),this.scissorTest=!1,this.viewport=new ut(0,0,e,t);const s={width:e,height:t,depth:n.depth},r=new At(s);this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:tn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isArrayTexture=this.textures[s].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Ba(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Yn extends Au{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Bc extends At{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Yt,this.minFilter=Yt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class wu extends At{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Yt,this.minFilter=Yt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class vn{constructor(e=new N(1/0,1/0,1/0),t=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Ht.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Ht.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Ht.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Ht):Ht.fromBufferAttribute(r,a),Ht.applyMatrix4(e.matrixWorld),this.expandByPoint(Ht);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),as.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),as.copy(n.boundingBox)),as.applyMatrix4(e.matrixWorld),this.union(as)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Ht),Ht.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Di),os.subVectors(this.max,Di),ti.subVectors(e.a,Di),ni.subVectors(e.b,Di),ii.subVectors(e.c,Di),xn.subVectors(ni,ti),Mn.subVectors(ii,ni),Un.subVectors(ti,ii);let t=[0,-xn.z,xn.y,0,-Mn.z,Mn.y,0,-Un.z,Un.y,xn.z,0,-xn.x,Mn.z,0,-Mn.x,Un.z,0,-Un.x,-xn.y,xn.x,0,-Mn.y,Mn.x,0,-Un.y,Un.x,0];return!cr(t,ti,ni,ii,os)||(t=[1,0,0,0,1,0,0,0,1],!cr(t,ti,ni,ii,os))?!1:(cs.crossVectors(xn,Mn),t=[cs.x,cs.y,cs.z],cr(t,ti,ni,ii,os))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Ht).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Ht).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(ln[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),ln[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),ln[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),ln[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),ln[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),ln[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),ln[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),ln[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(ln),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const ln=[new N,new N,new N,new N,new N,new N,new N,new N],Ht=new N,as=new vn,ti=new N,ni=new N,ii=new N,xn=new N,Mn=new N,Un=new N,Di=new N,os=new N,cs=new N,Fn=new N;function cr(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Fn.fromArray(i,r);const o=s.x*Math.abs(Fn.x)+s.y*Math.abs(Fn.y)+s.z*Math.abs(Fn.z),l=e.dot(Fn),c=t.dot(Fn),d=n.dot(Fn);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>o)return!1}return!0}const Ru=new vn,Li=new N,lr=new N;class qs{constructor(e=new N,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Ru.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Li.subVectors(e,this.center);const t=Li.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Li,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(lr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Li.copy(e.center).add(lr)),this.expandByPoint(Li.copy(e.center).sub(lr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const un=new N,ur=new N,ls=new N,yn=new N,hr=new N,us=new N,dr=new N;class $s{constructor(e=new N,t=new N(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,un)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=un.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(un.copy(this.origin).addScaledVector(this.direction,t),un.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){ur.copy(e).add(t).multiplyScalar(.5),ls.copy(t).sub(e).normalize(),yn.copy(this.origin).sub(ur);const r=e.distanceTo(t)*.5,a=-this.direction.dot(ls),o=yn.dot(this.direction),l=-yn.dot(ls),c=yn.lengthSq(),d=Math.abs(1-a*a);let h,p,m,v;if(d>0)if(h=a*l-o,p=a*o-l,v=r*d,h>=0)if(p>=-v)if(p<=v){const x=1/d;h*=x,p*=x,m=h*(h+a*p+2*o)+p*(a*h+p+2*l)+c}else p=r,h=Math.max(0,-(a*p+o)),m=-h*h+p*(p+2*l)+c;else p=-r,h=Math.max(0,-(a*p+o)),m=-h*h+p*(p+2*l)+c;else p<=-v?(h=Math.max(0,-(-a*r+o)),p=h>0?-r:Math.min(Math.max(-r,-l),r),m=-h*h+p*(p+2*l)+c):p<=v?(h=0,p=Math.min(Math.max(-r,-l),r),m=p*(p+2*l)+c):(h=Math.max(0,-(a*r+o)),p=h>0?r:Math.min(Math.max(-r,-l),r),m=-h*h+p*(p+2*l)+c);else p=a>0?-r:r,h=Math.max(0,-(a*p+o)),m=-h*h+p*(p+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,h),s&&s.copy(ur).addScaledVector(ls,p),m}intersectSphere(e,t){un.subVectors(e.center,this.origin);const n=un.dot(this.direction),s=un.dot(un)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,d=1/this.direction.y,h=1/this.direction.z,p=this.origin;return c>=0?(n=(e.min.x-p.x)*c,s=(e.max.x-p.x)*c):(n=(e.max.x-p.x)*c,s=(e.min.x-p.x)*c),d>=0?(r=(e.min.y-p.y)*d,a=(e.max.y-p.y)*d):(r=(e.max.y-p.y)*d,a=(e.min.y-p.y)*d),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),h>=0?(o=(e.min.z-p.z)*h,l=(e.max.z-p.z)*h):(o=(e.max.z-p.z)*h,l=(e.min.z-p.z)*h),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,un)!==null}intersectTriangle(e,t,n,s,r){hr.subVectors(t,e),us.subVectors(n,e),dr.crossVectors(hr,us);let a=this.direction.dot(dr),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;yn.subVectors(this.origin,e);const l=o*this.direction.dot(us.crossVectors(yn,us));if(l<0)return null;const c=o*this.direction.dot(hr.cross(yn));if(c<0||l+c>a)return null;const d=-o*yn.dot(dr);return d<0?null:this.at(d/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ot{constructor(e,t,n,s,r,a,o,l,c,d,h,p,m,v,x,g){ot.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,d,h,p,m,v,x,g)}set(e,t,n,s,r,a,o,l,c,d,h,p,m,v,x,g){const u=this.elements;return u[0]=e,u[4]=t,u[8]=n,u[12]=s,u[1]=r,u[5]=a,u[9]=o,u[13]=l,u[2]=c,u[6]=d,u[10]=h,u[14]=p,u[3]=m,u[7]=v,u[11]=x,u[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ot().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/si.setFromMatrixColumn(e,0).length(),r=1/si.setFromMatrixColumn(e,1).length(),a=1/si.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),d=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){const p=a*d,m=a*h,v=o*d,x=o*h;t[0]=l*d,t[4]=-l*h,t[8]=c,t[1]=m+v*c,t[5]=p-x*c,t[9]=-o*l,t[2]=x-p*c,t[6]=v+m*c,t[10]=a*l}else if(e.order==="YXZ"){const p=l*d,m=l*h,v=c*d,x=c*h;t[0]=p+x*o,t[4]=v*o-m,t[8]=a*c,t[1]=a*h,t[5]=a*d,t[9]=-o,t[2]=m*o-v,t[6]=x+p*o,t[10]=a*l}else if(e.order==="ZXY"){const p=l*d,m=l*h,v=c*d,x=c*h;t[0]=p-x*o,t[4]=-a*h,t[8]=v+m*o,t[1]=m+v*o,t[5]=a*d,t[9]=x-p*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const p=a*d,m=a*h,v=o*d,x=o*h;t[0]=l*d,t[4]=v*c-m,t[8]=p*c+x,t[1]=l*h,t[5]=x*c+p,t[9]=m*c-v,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const p=a*l,m=a*c,v=o*l,x=o*c;t[0]=l*d,t[4]=x-p*h,t[8]=v*h+m,t[1]=h,t[5]=a*d,t[9]=-o*d,t[2]=-c*d,t[6]=m*h+v,t[10]=p-x*h}else if(e.order==="XZY"){const p=a*l,m=a*c,v=o*l,x=o*c;t[0]=l*d,t[4]=-h,t[8]=c*d,t[1]=p*h+x,t[5]=a*d,t[9]=m*h-v,t[2]=v*h-m,t[6]=o*d,t[10]=x*h+p}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Cu,e,Pu)}lookAt(e,t,n){const s=this.elements;return Lt.subVectors(e,t),Lt.lengthSq()===0&&(Lt.z=1),Lt.normalize(),Sn.crossVectors(n,Lt),Sn.lengthSq()===0&&(Math.abs(n.z)===1?Lt.x+=1e-4:Lt.z+=1e-4,Lt.normalize(),Sn.crossVectors(n,Lt)),Sn.normalize(),hs.crossVectors(Lt,Sn),s[0]=Sn.x,s[4]=hs.x,s[8]=Lt.x,s[1]=Sn.y,s[5]=hs.y,s[9]=Lt.y,s[2]=Sn.z,s[6]=hs.z,s[10]=Lt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],d=n[1],h=n[5],p=n[9],m=n[13],v=n[2],x=n[6],g=n[10],u=n[14],A=n[3],b=n[7],E=n[11],D=n[15],R=s[0],P=s[4],U=s[8],T=s[12],S=s[1],C=s[5],B=s[9],k=s[13],$=s[2],q=s[6],X=s[10],Z=s[14],W=s[3],se=s[7],ue=s[11],ve=s[15];return r[0]=a*R+o*S+l*$+c*W,r[4]=a*P+o*C+l*q+c*se,r[8]=a*U+o*B+l*X+c*ue,r[12]=a*T+o*k+l*Z+c*ve,r[1]=d*R+h*S+p*$+m*W,r[5]=d*P+h*C+p*q+m*se,r[9]=d*U+h*B+p*X+m*ue,r[13]=d*T+h*k+p*Z+m*ve,r[2]=v*R+x*S+g*$+u*W,r[6]=v*P+x*C+g*q+u*se,r[10]=v*U+x*B+g*X+u*ue,r[14]=v*T+x*k+g*Z+u*ve,r[3]=A*R+b*S+E*$+D*W,r[7]=A*P+b*C+E*q+D*se,r[11]=A*U+b*B+E*X+D*ue,r[15]=A*T+b*k+E*Z+D*ve,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],d=e[2],h=e[6],p=e[10],m=e[14],v=e[3],x=e[7],g=e[11],u=e[15];return v*(+r*l*h-s*c*h-r*o*p+n*c*p+s*o*m-n*l*m)+x*(+t*l*m-t*c*p+r*a*p-s*a*m+s*c*d-r*l*d)+g*(+t*c*h-t*o*m-r*a*h+n*a*m+r*o*d-n*c*d)+u*(-s*o*d-t*l*h+t*o*p+s*a*h-n*a*p+n*l*d)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],h=e[9],p=e[10],m=e[11],v=e[12],x=e[13],g=e[14],u=e[15],A=h*g*c-x*p*c+x*l*m-o*g*m-h*l*u+o*p*u,b=v*p*c-d*g*c-v*l*m+a*g*m+d*l*u-a*p*u,E=d*x*c-v*h*c+v*o*m-a*x*m-d*o*u+a*h*u,D=v*h*l-d*x*l-v*o*p+a*x*p+d*o*g-a*h*g,R=t*A+n*b+s*E+r*D;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const P=1/R;return e[0]=A*P,e[1]=(x*p*r-h*g*r-x*s*m+n*g*m+h*s*u-n*p*u)*P,e[2]=(o*g*r-x*l*r+x*s*c-n*g*c-o*s*u+n*l*u)*P,e[3]=(h*l*r-o*p*r-h*s*c+n*p*c+o*s*m-n*l*m)*P,e[4]=b*P,e[5]=(d*g*r-v*p*r+v*s*m-t*g*m-d*s*u+t*p*u)*P,e[6]=(v*l*r-a*g*r-v*s*c+t*g*c+a*s*u-t*l*u)*P,e[7]=(a*p*r-d*l*r+d*s*c-t*p*c-a*s*m+t*l*m)*P,e[8]=E*P,e[9]=(v*h*r-d*x*r-v*n*m+t*x*m+d*n*u-t*h*u)*P,e[10]=(a*x*r-v*o*r+v*n*c-t*x*c-a*n*u+t*o*u)*P,e[11]=(d*o*r-a*h*r-d*n*c+t*h*c+a*n*m-t*o*m)*P,e[12]=D*P,e[13]=(d*x*s-v*h*s+v*n*p-t*x*p-d*n*g+t*h*g)*P,e[14]=(v*o*s-a*x*s-v*n*l+t*x*l+a*n*g-t*o*g)*P,e[15]=(a*h*s-d*o*s+d*n*l-t*h*l-a*n*p+t*o*p)*P,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,d=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,d*o+n,d*l-s*a,0,c*l-s*o,d*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,d=a+a,h=o+o,p=r*c,m=r*d,v=r*h,x=a*d,g=a*h,u=o*h,A=l*c,b=l*d,E=l*h,D=n.x,R=n.y,P=n.z;return s[0]=(1-(x+u))*D,s[1]=(m+E)*D,s[2]=(v-b)*D,s[3]=0,s[4]=(m-E)*R,s[5]=(1-(p+u))*R,s[6]=(g+A)*R,s[7]=0,s[8]=(v+b)*P,s[9]=(g-A)*P,s[10]=(1-(p+x))*P,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=si.set(s[0],s[1],s[2]).length();const a=si.set(s[4],s[5],s[6]).length(),o=si.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],Gt.copy(this);const c=1/r,d=1/a,h=1/o;return Gt.elements[0]*=c,Gt.elements[1]*=c,Gt.elements[2]*=c,Gt.elements[4]*=d,Gt.elements[5]*=d,Gt.elements[6]*=d,Gt.elements[8]*=h,Gt.elements[9]*=h,Gt.elements[10]*=h,t.setFromRotationMatrix(Gt),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,s,r,a,o=nn,l=!1){const c=this.elements,d=2*r/(t-e),h=2*r/(n-s),p=(t+e)/(t-e),m=(n+s)/(n-s);let v,x;if(l)v=r/(a-r),x=a*r/(a-r);else if(o===nn)v=-(a+r)/(a-r),x=-2*a*r/(a-r);else if(o===ks)v=-a/(a-r),x=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=p,c[12]=0,c[1]=0,c[5]=h,c[9]=m,c[13]=0,c[2]=0,c[6]=0,c[10]=v,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=nn,l=!1){const c=this.elements,d=2/(t-e),h=2/(n-s),p=-(t+e)/(t-e),m=-(n+s)/(n-s);let v,x;if(l)v=1/(a-r),x=a/(a-r);else if(o===nn)v=-2/(a-r),x=-(a+r)/(a-r);else if(o===ks)v=-1/(a-r),x=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=0,c[12]=p,c[1]=0,c[5]=h,c[9]=0,c[13]=m,c[2]=0,c[6]=0,c[10]=v,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const si=new N,Gt=new ot,Cu=new N(0,0,0),Pu=new N(1,1,1),Sn=new N,hs=new N,Lt=new N,xo=new ot,Mo=new $n;class on{constructor(e=0,t=0,n=0,s=on.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],d=s[9],h=s[2],p=s[6],m=s[10];switch(t){case"XYZ":this._y=Math.asin(ze(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-d,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(p,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ze(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,r),this._z=0);break;case"ZXY":this._x=Math.asin(ze(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-h,m),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-ze(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(p,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(ze(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-h,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-ze(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(p,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-d,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return xo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(xo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Mo.setFromEuler(this),this.setFromQuaternion(Mo,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}on.DEFAULT_ORDER="XYZ";class za{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Du=0;const yo=new N,ri=new $n,hn=new ot,ds=new N,Ii=new N,Lu=new N,Iu=new $n,So=new N(1,0,0),Eo=new N(0,1,0),To=new N(0,0,1),bo={type:"added"},Nu={type:"removed"},ai={type:"childadded",child:null},fr={type:"childremoved",child:null};class Mt extends Kn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Du++}),this.uuid=bi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Mt.DEFAULT_UP.clone();const e=new N,t=new on,n=new $n,s=new N(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ot},normalMatrix:{value:new Ue}}),this.matrix=new ot,this.matrixWorld=new ot,this.matrixAutoUpdate=Mt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Mt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new za,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ri.setFromAxisAngle(e,t),this.quaternion.multiply(ri),this}rotateOnWorldAxis(e,t){return ri.setFromAxisAngle(e,t),this.quaternion.premultiply(ri),this}rotateX(e){return this.rotateOnAxis(So,e)}rotateY(e){return this.rotateOnAxis(Eo,e)}rotateZ(e){return this.rotateOnAxis(To,e)}translateOnAxis(e,t){return yo.copy(e).applyQuaternion(this.quaternion),this.position.add(yo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(So,e)}translateY(e){return this.translateOnAxis(Eo,e)}translateZ(e){return this.translateOnAxis(To,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(hn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ds.copy(e):ds.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Ii.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?hn.lookAt(Ii,ds,this.up):hn.lookAt(ds,Ii,this.up),this.quaternion.setFromRotationMatrix(hn),s&&(hn.extractRotation(s.matrixWorld),ri.setFromRotationMatrix(hn),this.quaternion.premultiply(ri.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(bo),ai.child=e,this.dispatchEvent(ai),ai.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Nu),fr.child=e,this.dispatchEvent(fr),fr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),hn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),hn.multiply(e.parent.matrixWorld)),e.applyMatrix4(hn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(bo),ai.child=e,this.dispatchEvent(ai),ai.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ii,e,Lu),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ii,Iu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){const h=l[c];r(e.shapes,h)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),d=a(e.images),h=a(e.shapes),p=a(e.skeletons),m=a(e.animations),v=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),d.length>0&&(n.images=d),h.length>0&&(n.shapes=h),p.length>0&&(n.skeletons=p),m.length>0&&(n.animations=m),v.length>0&&(n.nodes=v)}return n.object=s,n;function a(o){const l=[];for(const c in o){const d=o[c];delete d.metadata,l.push(d)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}Mt.DEFAULT_UP=new N(0,1,0);Mt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Mt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Vt=new N,dn=new N,pr=new N,fn=new N,oi=new N,ci=new N,Ao=new N,mr=new N,gr=new N,_r=new N,vr=new ut,xr=new ut,Mr=new ut;class Wt{constructor(e=new N,t=new N,n=new N){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Vt.subVectors(e,t),s.cross(Vt);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Vt.subVectors(s,t),dn.subVectors(n,t),pr.subVectors(e,t);const a=Vt.dot(Vt),o=Vt.dot(dn),l=Vt.dot(pr),c=dn.dot(dn),d=dn.dot(pr),h=a*c-o*o;if(h===0)return r.set(0,0,0),null;const p=1/h,m=(c*l-o*d)*p,v=(a*d-o*l)*p;return r.set(1-m-v,v,m)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,fn)===null?!1:fn.x>=0&&fn.y>=0&&fn.x+fn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,fn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,fn.x),l.addScaledVector(a,fn.y),l.addScaledVector(o,fn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return vr.setScalar(0),xr.setScalar(0),Mr.setScalar(0),vr.fromBufferAttribute(e,t),xr.fromBufferAttribute(e,n),Mr.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(vr,r.x),a.addScaledVector(xr,r.y),a.addScaledVector(Mr,r.z),a}static isFrontFacing(e,t,n,s){return Vt.subVectors(n,t),dn.subVectors(e,t),Vt.cross(dn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Vt.subVectors(this.c,this.b),dn.subVectors(this.a,this.b),Vt.cross(dn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Wt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Wt.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return Wt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return Wt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Wt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;oi.subVectors(s,n),ci.subVectors(r,n),mr.subVectors(e,n);const l=oi.dot(mr),c=ci.dot(mr);if(l<=0&&c<=0)return t.copy(n);gr.subVectors(e,s);const d=oi.dot(gr),h=ci.dot(gr);if(d>=0&&h<=d)return t.copy(s);const p=l*h-d*c;if(p<=0&&l>=0&&d<=0)return a=l/(l-d),t.copy(n).addScaledVector(oi,a);_r.subVectors(e,r);const m=oi.dot(_r),v=ci.dot(_r);if(v>=0&&m<=v)return t.copy(r);const x=m*c-l*v;if(x<=0&&c>=0&&v<=0)return o=c/(c-v),t.copy(n).addScaledVector(ci,o);const g=d*v-m*h;if(g<=0&&h-d>=0&&m-v>=0)return Ao.subVectors(r,s),o=(h-d)/(h-d+(m-v)),t.copy(s).addScaledVector(Ao,o);const u=1/(g+x+p);return a=x*u,o=p*u,t.copy(n).addScaledVector(oi,a).addScaledVector(ci,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const zc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},En={h:0,s:0,l:0},fs={h:0,s:0,l:0};function yr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Fe{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Nt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,qe.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=qe.workingColorSpace){return this.r=e,this.g=t,this.b=n,qe.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=qe.workingColorSpace){if(e=Oa(e,1),t=ze(t,0,1),n=ze(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=yr(a,r,e+1/3),this.g=yr(a,r,e),this.b=yr(a,r,e-1/3)}return qe.colorSpaceToWorking(this,s),this}setStyle(e,t=Nt){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Nt){const n=zc[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=_n(e.r),this.g=_n(e.g),this.b=_n(e.b),this}copyLinearToSRGB(e){return this.r=vi(e.r),this.g=vi(e.g),this.b=vi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Nt){return qe.workingToColorSpace(St.copy(this),e),Math.round(ze(St.r*255,0,255))*65536+Math.round(ze(St.g*255,0,255))*256+Math.round(ze(St.b*255,0,255))}getHexString(e=Nt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=qe.workingColorSpace){qe.workingToColorSpace(St.copy(this),t);const n=St.r,s=St.g,r=St.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const d=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=d<=.5?h/(a+o):h/(2-a-o),a){case n:l=(s-r)/h+(s<r?6:0);break;case s:l=(r-n)/h+2;break;case r:l=(n-s)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=d,e}getRGB(e,t=qe.workingColorSpace){return qe.workingToColorSpace(St.copy(this),t),e.r=St.r,e.g=St.g,e.b=St.b,e}getStyle(e=Nt){qe.workingToColorSpace(St.copy(this),e);const t=St.r,n=St.g,s=St.b;return e!==Nt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(En),this.setHSL(En.h+e,En.s+t,En.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(En),e.getHSL(fs);const n=Xi(En.h,fs.h,t),s=Xi(En.s,fs.s,t),r=Xi(En.l,fs.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const St=new Fe;Fe.NAMES=zc;let Uu=0;class Ai extends Kn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Uu++}),this.uuid=bi(),this.name="",this.type="Material",this.blending=_i,this.side=Pn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=zr,this.blendDst=kr,this.blendEquation=Gn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Fe(0,0,0),this.blendAlpha=0,this.depthFunc=Mi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=uo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Qn,this.stencilZFail=Qn,this.stencilZPass=Qn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==_i&&(n.blending=this.blending),this.side!==Pn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==zr&&(n.blendSrc=this.blendSrc),this.blendDst!==kr&&(n.blendDst=this.blendDst),this.blendEquation!==Gn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Mi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==uo&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Qn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Qn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Qn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class kc extends Ai{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.combine=Tc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const dt=new N,ps=new De;let Fu=0;class rn{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Fu++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=ho,this.updateRanges=[],this.gpuType=gn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ps.fromBufferAttribute(this,t),ps.applyMatrix3(e),this.setXY(t,ps.x,ps.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix3(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix4(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyNormalMatrix(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.transformDirection(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=fi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Tt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=fi(t,this.array)),t}setX(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=fi(t,this.array)),t}setY(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=fi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=fi(t,this.array)),t}setW(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),n=Tt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),n=Tt(n,this.array),s=Tt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),n=Tt(n,this.array),s=Tt(s,this.array),r=Tt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==ho&&(e.usage=this.usage),e}}class Hc extends rn{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Gc extends rn{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class ct extends rn{constructor(e,t,n){super(new Float32Array(e),t,n)}}let Ou=0;const Bt=new ot,Sr=new Mt,li=new N,It=new vn,Ni=new vn,xt=new N;class Ut extends Kn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ou++}),this.uuid=bi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Oc(e)?Gc:Hc)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ue().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Bt.makeRotationFromQuaternion(e),this.applyMatrix4(Bt),this}rotateX(e){return Bt.makeRotationX(e),this.applyMatrix4(Bt),this}rotateY(e){return Bt.makeRotationY(e),this.applyMatrix4(Bt),this}rotateZ(e){return Bt.makeRotationZ(e),this.applyMatrix4(Bt),this}translate(e,t,n){return Bt.makeTranslation(e,t,n),this.applyMatrix4(Bt),this}scale(e,t,n){return Bt.makeScale(e,t,n),this.applyMatrix4(Bt),this}lookAt(e){return Sr.lookAt(e),Sr.updateMatrix(),this.applyMatrix4(Sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(li).negate(),this.translate(li.x,li.y,li.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ct(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new vn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];It.setFromBufferAttribute(r),this.morphTargetsRelative?(xt.addVectors(this.boundingBox.min,It.min),this.boundingBox.expandByPoint(xt),xt.addVectors(this.boundingBox.max,It.max),this.boundingBox.expandByPoint(xt)):(this.boundingBox.expandByPoint(It.min),this.boundingBox.expandByPoint(It.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new qs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(e){const n=this.boundingSphere.center;if(It.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Ni.setFromBufferAttribute(o),this.morphTargetsRelative?(xt.addVectors(It.min,Ni.min),It.expandByPoint(xt),xt.addVectors(It.max,Ni.max),It.expandByPoint(xt)):(It.expandByPoint(Ni.min),It.expandByPoint(Ni.max))}It.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)xt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(xt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,d=o.count;c<d;c++)xt.fromBufferAttribute(o,c),l&&(li.fromBufferAttribute(e,c),xt.add(li)),s=Math.max(s,n.distanceToSquared(xt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new rn(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let U=0;U<n.count;U++)o[U]=new N,l[U]=new N;const c=new N,d=new N,h=new N,p=new De,m=new De,v=new De,x=new N,g=new N;function u(U,T,S){c.fromBufferAttribute(n,U),d.fromBufferAttribute(n,T),h.fromBufferAttribute(n,S),p.fromBufferAttribute(r,U),m.fromBufferAttribute(r,T),v.fromBufferAttribute(r,S),d.sub(c),h.sub(c),m.sub(p),v.sub(p);const C=1/(m.x*v.y-v.x*m.y);isFinite(C)&&(x.copy(d).multiplyScalar(v.y).addScaledVector(h,-m.y).multiplyScalar(C),g.copy(h).multiplyScalar(m.x).addScaledVector(d,-v.x).multiplyScalar(C),o[U].add(x),o[T].add(x),o[S].add(x),l[U].add(g),l[T].add(g),l[S].add(g))}let A=this.groups;A.length===0&&(A=[{start:0,count:e.count}]);for(let U=0,T=A.length;U<T;++U){const S=A[U],C=S.start,B=S.count;for(let k=C,$=C+B;k<$;k+=3)u(e.getX(k+0),e.getX(k+1),e.getX(k+2))}const b=new N,E=new N,D=new N,R=new N;function P(U){D.fromBufferAttribute(s,U),R.copy(D);const T=o[U];b.copy(T),b.sub(D.multiplyScalar(D.dot(T))).normalize(),E.crossVectors(R,T);const C=E.dot(l[U])<0?-1:1;a.setXYZW(U,b.x,b.y,b.z,C)}for(let U=0,T=A.length;U<T;++U){const S=A[U],C=S.start,B=S.count;for(let k=C,$=C+B;k<$;k+=3)P(e.getX(k+0)),P(e.getX(k+1)),P(e.getX(k+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new rn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let p=0,m=n.count;p<m;p++)n.setXYZ(p,0,0,0);const s=new N,r=new N,a=new N,o=new N,l=new N,c=new N,d=new N,h=new N;if(e)for(let p=0,m=e.count;p<m;p+=3){const v=e.getX(p+0),x=e.getX(p+1),g=e.getX(p+2);s.fromBufferAttribute(t,v),r.fromBufferAttribute(t,x),a.fromBufferAttribute(t,g),d.subVectors(a,r),h.subVectors(s,r),d.cross(h),o.fromBufferAttribute(n,v),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,g),o.add(d),l.add(d),c.add(d),n.setXYZ(v,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(g,c.x,c.y,c.z)}else for(let p=0,m=t.count;p<m;p+=3)s.fromBufferAttribute(t,p+0),r.fromBufferAttribute(t,p+1),a.fromBufferAttribute(t,p+2),d.subVectors(a,r),h.subVectors(s,r),d.cross(h),n.setXYZ(p+0,d.x,d.y,d.z),n.setXYZ(p+1,d.x,d.y,d.z),n.setXYZ(p+2,d.x,d.y,d.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)xt.fromBufferAttribute(e,t),xt.normalize(),e.setXYZ(t,xt.x,xt.y,xt.z)}toNonIndexed(){function e(o,l){const c=o.array,d=o.itemSize,h=o.normalized,p=new c.constructor(l.length*d);let m=0,v=0;for(let x=0,g=l.length;x<g;x++){o.isInterleavedBufferAttribute?m=l[x]*o.data.stride+o.offset:m=l[x]*d;for(let u=0;u<d;u++)p[v++]=c[m++]}return new rn(p,d,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Ut,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let d=0,h=c.length;d<h;d++){const p=c[d],m=e(p,n);l.push(m)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],d=[];for(let h=0,p=c.length;h<p;h++){const m=c[h];d.push(m.toJSON(e.data))}d.length>0&&(s[l]=d,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const d=s[c];this.setAttribute(c,d.clone(t))}const r=e.morphAttributes;for(const c in r){const d=[],h=r[c];for(let p=0,m=h.length;p<m;p++)d.push(h[p].clone(t));this.morphAttributes[c]=d}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,d=a.length;c<d;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const wo=new ot,On=new $s,ms=new qs,Ro=new N,gs=new N,_s=new N,vs=new N,Er=new N,xs=new N,Co=new N,Ms=new N;class it extends Mt{constructor(e=new Ut,t=new kc){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){xs.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const d=o[l],h=r[l];d!==0&&(Er.fromBufferAttribute(h,e),a?xs.addScaledVector(Er,d):xs.addScaledVector(Er.sub(t),d))}t.add(xs)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ms.copy(n.boundingSphere),ms.applyMatrix4(r),On.copy(e.ray).recast(e.near),!(ms.containsPoint(On.origin)===!1&&(On.intersectSphere(ms,Ro)===null||On.origin.distanceToSquared(Ro)>(e.far-e.near)**2))&&(wo.copy(r).invert(),On.copy(e.ray).applyMatrix4(wo),!(n.boundingBox!==null&&On.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,On)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,d=r.attributes.uv1,h=r.attributes.normal,p=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let v=0,x=p.length;v<x;v++){const g=p[v],u=a[g.materialIndex],A=Math.max(g.start,m.start),b=Math.min(o.count,Math.min(g.start+g.count,m.start+m.count));for(let E=A,D=b;E<D;E+=3){const R=o.getX(E),P=o.getX(E+1),U=o.getX(E+2);s=ys(this,u,e,n,c,d,h,R,P,U),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=g.materialIndex,t.push(s))}}else{const v=Math.max(0,m.start),x=Math.min(o.count,m.start+m.count);for(let g=v,u=x;g<u;g+=3){const A=o.getX(g),b=o.getX(g+1),E=o.getX(g+2);s=ys(this,a,e,n,c,d,h,A,b,E),s&&(s.faceIndex=Math.floor(g/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let v=0,x=p.length;v<x;v++){const g=p[v],u=a[g.materialIndex],A=Math.max(g.start,m.start),b=Math.min(l.count,Math.min(g.start+g.count,m.start+m.count));for(let E=A,D=b;E<D;E+=3){const R=E,P=E+1,U=E+2;s=ys(this,u,e,n,c,d,h,R,P,U),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=g.materialIndex,t.push(s))}}else{const v=Math.max(0,m.start),x=Math.min(l.count,m.start+m.count);for(let g=v,u=x;g<u;g+=3){const A=g,b=g+1,E=g+2;s=ys(this,a,e,n,c,d,h,A,b,E),s&&(s.faceIndex=Math.floor(g/3),t.push(s))}}}}function Bu(i,e,t,n,s,r,a,o){let l;if(e.side===Ct?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===Pn,o),l===null)return null;Ms.copy(o),Ms.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Ms);return c<t.near||c>t.far?null:{distance:c,point:Ms.clone(),object:i}}function ys(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,gs),i.getVertexPosition(l,_s),i.getVertexPosition(c,vs);const d=Bu(i,e,t,n,gs,_s,vs,Co);if(d){const h=new N;Wt.getBarycoord(Co,gs,_s,vs,h),s&&(d.uv=Wt.getInterpolatedAttribute(s,o,l,c,h,new De)),r&&(d.uv1=Wt.getInterpolatedAttribute(r,o,l,c,h,new De)),a&&(d.normal=Wt.getInterpolatedAttribute(a,o,l,c,h,new N),d.normal.dot(n.direction)>0&&d.normal.multiplyScalar(-1));const p={a:o,b:l,c,normal:new N,materialIndex:0};Wt.getNormal(gs,_s,vs,p.normal),d.face=p,d.barycoord=h}return d}class wi extends Ut{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],d=[],h=[];let p=0,m=0;v("z","y","x",-1,-1,n,t,e,a,r,0),v("z","y","x",1,-1,n,t,-e,a,r,1),v("x","z","y",1,1,e,n,t,s,a,2),v("x","z","y",1,-1,e,n,-t,s,a,3),v("x","y","z",1,-1,e,t,n,s,r,4),v("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new ct(c,3)),this.setAttribute("normal",new ct(d,3)),this.setAttribute("uv",new ct(h,2));function v(x,g,u,A,b,E,D,R,P,U,T){const S=E/P,C=D/U,B=E/2,k=D/2,$=R/2,q=P+1,X=U+1;let Z=0,W=0;const se=new N;for(let ue=0;ue<X;ue++){const ve=ue*C-k;for(let Ie=0;Ie<q;Ie++){const We=Ie*S-B;se[x]=We*A,se[g]=ve*b,se[u]=$,c.push(se.x,se.y,se.z),se[x]=0,se[g]=0,se[u]=R>0?1:-1,d.push(se.x,se.y,se.z),h.push(Ie/P),h.push(1-ue/U),Z+=1}}for(let ue=0;ue<U;ue++)for(let ve=0;ve<P;ve++){const Ie=p+ve+q*ue,We=p+ve+q*(ue+1),$e=p+(ve+1)+q*(ue+1),Ve=p+(ve+1)+q*ue;l.push(Ie,We,Ve),l.push(We,$e,Ve),W+=6}o.addGroup(m,W,T),m+=W,p+=Z}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new wi(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Ti(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function bt(i){const e={};for(let t=0;t<i.length;t++){const n=Ti(i[t]);for(const s in n)e[s]=n[s]}return e}function zu(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Vc(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:qe.workingColorSpace}const ku={clone:Ti,merge:bt};var Hu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Gu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Dn extends Ai{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Hu,this.fragmentShader=Gu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ti(e.uniforms),this.uniformsGroups=zu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Wc extends Mt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ot,this.projectionMatrix=new ot,this.projectionMatrixInverse=new ot,this.coordinateSystem=nn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Tn=new N,Po=new De,Do=new De;class kt extends Wc{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ki*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Wi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ki*2*Math.atan(Math.tan(Wi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Tn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Tn.x,Tn.y).multiplyScalar(-e/Tn.z),Tn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Tn.x,Tn.y).multiplyScalar(-e/Tn.z)}getViewSize(e,t){return this.getViewBounds(e,Po,Do),t.subVectors(Do,Po)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Wi*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const ui=-90,hi=1;class Vu extends Mt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new kt(ui,hi,e,t);s.layers=this.layers,this.add(s);const r=new kt(ui,hi,e,t);r.layers=this.layers,this.add(r);const a=new kt(ui,hi,e,t);a.layers=this.layers,this.add(a);const o=new kt(ui,hi,e,t);o.layers=this.layers,this.add(o);const l=new kt(ui,hi,e,t);l.layers=this.layers,this.add(l);const c=new kt(ui,hi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===nn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===ks)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,d]=this.children,h=e.getRenderTarget(),p=e.getActiveCubeFace(),m=e.getActiveMipmapLevel(),v=e.xr.enabled;e.xr.enabled=!1;const x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,a),e.setRenderTarget(n,2,s),e.render(t,o),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,s),e.render(t,d),e.setRenderTarget(h,p,m),e.xr.enabled=v,n.texture.needsPMREMUpdate=!0}}class Xc extends At{constructor(e=[],t=yi,n,s,r,a,o,l,c,d){super(e,t,n,s,r,a,o,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Wu extends Yn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Xc(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new wi(5,5,5),r=new Dn({name:"CubemapFromEquirect",uniforms:Ti(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ct,blending:Rn});r.uniforms.tEquirect.value=t;const a=new it(s,r),o=t.minFilter;return t.minFilter===Xn&&(t.minFilter=tn),new Vu(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}class qt extends Mt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Xu={type:"move"};class Tr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new qt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new qt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new qt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const x of e.hand.values()){const g=t.getJointPose(x,n),u=this._getHandJoint(c,x);g!==null&&(u.matrix.fromArray(g.transform.matrix),u.matrix.decompose(u.position,u.rotation,u.scale),u.matrixWorldNeedsUpdate=!0,u.jointRadius=g.radius),u.visible=g!==null}const d=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],p=d.position.distanceTo(h.position),m=.02,v=.005;c.inputState.pinching&&p>m+v?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&p<=m-v&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Xu)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new qt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class qu extends Mt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new on,this.environmentIntensity=1,this.environmentRotation=new on,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const br=new N,$u=new N,Yu=new Ue;class An{constructor(e=new N(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=br.subVectors(n,t).cross($u.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(br),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Yu.getNormalMatrix(e),s=this.coplanarPoint(br).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Bn=new qs,ju=new De(.5,.5),Ss=new N;class ka{constructor(e=new An,t=new An,n=new An,s=new An,r=new An,a=new An){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=nn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],d=r[4],h=r[5],p=r[6],m=r[7],v=r[8],x=r[9],g=r[10],u=r[11],A=r[12],b=r[13],E=r[14],D=r[15];if(s[0].setComponents(c-a,m-d,u-v,D-A).normalize(),s[1].setComponents(c+a,m+d,u+v,D+A).normalize(),s[2].setComponents(c+o,m+h,u+x,D+b).normalize(),s[3].setComponents(c-o,m-h,u-x,D-b).normalize(),n)s[4].setComponents(l,p,g,E).normalize(),s[5].setComponents(c-l,m-p,u-g,D-E).normalize();else if(s[4].setComponents(c-l,m-p,u-g,D-E).normalize(),t===nn)s[5].setComponents(c+l,m+p,u+g,D+E).normalize();else if(t===ks)s[5].setComponents(l,p,g,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Bn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Bn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Bn)}intersectsSprite(e){Bn.center.set(0,0,0);const t=ju.distanceTo(e.center);return Bn.radius=.7071067811865476+t,Bn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Bn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Ss.x=s.normal.x>0?e.max.x:e.min.x,Ss.y=s.normal.y>0?e.max.y:e.min.y,Ss.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ss)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class qc extends Ai{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Fe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const Vs=new N,Ws=new N,Lo=new ot,Ui=new $s,Es=new qs,Ar=new N,Io=new N;class Ku extends Mt{constructor(e=new Ut,t=new qc){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)Vs.fromBufferAttribute(t,s-1),Ws.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=Vs.distanceTo(Ws);e.setAttribute("lineDistance",new ct(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Es.copy(n.boundingSphere),Es.applyMatrix4(s),Es.radius+=r,e.ray.intersectsSphere(Es)===!1)return;Lo.copy(s).invert(),Ui.copy(e.ray).applyMatrix4(Lo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,d=n.index,p=n.attributes.position;if(d!==null){const m=Math.max(0,a.start),v=Math.min(d.count,a.start+a.count);for(let x=m,g=v-1;x<g;x+=c){const u=d.getX(x),A=d.getX(x+1),b=Ts(this,e,Ui,l,u,A,x);b&&t.push(b)}if(this.isLineLoop){const x=d.getX(v-1),g=d.getX(m),u=Ts(this,e,Ui,l,x,g,v-1);u&&t.push(u)}}else{const m=Math.max(0,a.start),v=Math.min(p.count,a.start+a.count);for(let x=m,g=v-1;x<g;x+=c){const u=Ts(this,e,Ui,l,x,x+1,x);u&&t.push(u)}if(this.isLineLoop){const x=Ts(this,e,Ui,l,v-1,m,v-1);x&&t.push(x)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ts(i,e,t,n,s,r,a){const o=i.geometry.attributes.position;if(Vs.fromBufferAttribute(o,s),Ws.fromBufferAttribute(o,r),t.distanceSqToSegment(Vs,Ws,Ar,Io)>n)return;Ar.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(Ar);if(!(c<e.near||c>e.far))return{distance:c,point:Io.clone().applyMatrix4(i.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:i}}const No=new N,Uo=new N;class Zu extends Ku{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)No.fromBufferAttribute(t,s),Uo.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+No.distanceTo(Uo);e.setAttribute("lineDistance",new ct(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class $c extends At{constructor(e,t,n=qn,s,r,a,o=Yt,l=Yt,c,d=Yi,h=1){if(d!==Yi&&d!==ji)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const p={width:e,height:t,depth:h};super(p,s,r,a,o,l,d,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ba(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Yc extends At{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Ys extends Ut{constructor(e=1,t=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:s},t=Math.max(3,t);const r=[],a=[],o=[],l=[],c=new N,d=new De;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let h=0,p=3;h<=t;h++,p+=3){const m=n+h/t*s;c.x=e*Math.cos(m),c.y=e*Math.sin(m),a.push(c.x,c.y,c.z),o.push(0,0,1),d.x=(a[p]/e+1)/2,d.y=(a[p+1]/e+1)/2,l.push(d.x,d.y)}for(let h=1;h<=t;h++)r.push(h,h+1,0);this.setIndex(r),this.setAttribute("position",new ct(a,3)),this.setAttribute("normal",new ct(o,3)),this.setAttribute("uv",new ct(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ys(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class Ha extends Ut{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const d=[],h=[],p=[],m=[];let v=0;const x=[],g=n/2;let u=0;A(),a===!1&&(e>0&&b(!0),t>0&&b(!1)),this.setIndex(d),this.setAttribute("position",new ct(h,3)),this.setAttribute("normal",new ct(p,3)),this.setAttribute("uv",new ct(m,2));function A(){const E=new N,D=new N;let R=0;const P=(t-e)/n;for(let U=0;U<=r;U++){const T=[],S=U/r,C=S*(t-e)+e;for(let B=0;B<=s;B++){const k=B/s,$=k*l+o,q=Math.sin($),X=Math.cos($);D.x=C*q,D.y=-S*n+g,D.z=C*X,h.push(D.x,D.y,D.z),E.set(q,P,X).normalize(),p.push(E.x,E.y,E.z),m.push(k,1-S),T.push(v++)}x.push(T)}for(let U=0;U<s;U++)for(let T=0;T<r;T++){const S=x[T][U],C=x[T+1][U],B=x[T+1][U+1],k=x[T][U+1];(e>0||T!==0)&&(d.push(S,C,k),R+=3),(t>0||T!==r-1)&&(d.push(C,B,k),R+=3)}c.addGroup(u,R,0),u+=R}function b(E){const D=v,R=new De,P=new N;let U=0;const T=E===!0?e:t,S=E===!0?1:-1;for(let B=1;B<=s;B++)h.push(0,g*S,0),p.push(0,S,0),m.push(.5,.5),v++;const C=v;for(let B=0;B<=s;B++){const $=B/s*l+o,q=Math.cos($),X=Math.sin($);P.x=T*X,P.y=g*S,P.z=T*q,h.push(P.x,P.y,P.z),p.push(0,S,0),R.x=q*.5+.5,R.y=X*.5*S+.5,m.push(R.x,R.y),v++}for(let B=0;B<s;B++){const k=D+B,$=C+B;E===!0?d.push($,$+1,k):d.push($+1,$,k),U+=3}c.addGroup(u,U,E===!0?1:2),u+=U}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ha(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class js extends Ut{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,d=l+1,h=e/o,p=t/l,m=[],v=[],x=[],g=[];for(let u=0;u<d;u++){const A=u*p-a;for(let b=0;b<c;b++){const E=b*h-r;v.push(E,-A,0),x.push(0,0,1),g.push(b/o),g.push(1-u/l)}}for(let u=0;u<l;u++)for(let A=0;A<o;A++){const b=A+c*u,E=A+c*(u+1),D=A+1+c*(u+1),R=A+1+c*u;m.push(b,E,R),m.push(E,D,R)}this.setIndex(m),this.setAttribute("position",new ct(v,3)),this.setAttribute("normal",new ct(x,3)),this.setAttribute("uv",new ct(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new js(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ks extends Ut{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const d=[],h=new N,p=new N,m=[],v=[],x=[],g=[];for(let u=0;u<=n;u++){const A=[],b=u/n;let E=0;u===0&&a===0?E=.5/t:u===n&&l===Math.PI&&(E=-.5/t);for(let D=0;D<=t;D++){const R=D/t;h.x=-e*Math.cos(s+R*r)*Math.sin(a+b*o),h.y=e*Math.cos(a+b*o),h.z=e*Math.sin(s+R*r)*Math.sin(a+b*o),v.push(h.x,h.y,h.z),p.copy(h).normalize(),x.push(p.x,p.y,p.z),g.push(R+E,1-b),A.push(c++)}d.push(A)}for(let u=0;u<n;u++)for(let A=0;A<t;A++){const b=d[u][A+1],E=d[u][A],D=d[u+1][A],R=d[u+1][A+1];(u!==0||a>0)&&m.push(b,E,R),(u!==n-1||l<Math.PI)&&m.push(E,D,R)}this.setIndex(m),this.setAttribute("position",new ct(v,3)),this.setAttribute("normal",new ct(x,3)),this.setAttribute("uv",new ct(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ks(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Ga extends Ut{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const a=[],o=[],l=[],c=[],d=new N,h=new N,p=new N;for(let m=0;m<=n;m++)for(let v=0;v<=s;v++){const x=v/s*r,g=m/n*Math.PI*2;h.x=(e+t*Math.cos(g))*Math.cos(x),h.y=(e+t*Math.cos(g))*Math.sin(x),h.z=t*Math.sin(g),o.push(h.x,h.y,h.z),d.x=e*Math.cos(x),d.y=e*Math.sin(x),p.subVectors(h,d).normalize(),l.push(p.x,p.y,p.z),c.push(v/s),c.push(m/n)}for(let m=1;m<=n;m++)for(let v=1;v<=s;v++){const x=(s+1)*m+v-1,g=(s+1)*(m-1)+v-1,u=(s+1)*(m-1)+v,A=(s+1)*m+v;a.push(x,g,A),a.push(g,u,A)}this.setIndex(a),this.setAttribute("position",new ct(o,3)),this.setAttribute("normal",new ct(l,3)),this.setAttribute("uv",new ct(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ga(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class Va extends Ai{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Fe(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Uc,this.normalScale=new De(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Ln extends Va{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new De(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return ze(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Fe(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Fe(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Fe(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Ju extends Ai{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Yl,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Qu extends Ai{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class jc extends Mt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Fe(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class eh extends jc{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Mt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Fe(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const wr=new ot,Fo=new N,Oo=new N;class th{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new De(512,512),this.mapType=an,this.map=null,this.mapPass=null,this.matrix=new ot,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ka,this._frameExtents=new De(1,1),this._viewportCount=1,this._viewports=[new ut(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;Fo.setFromMatrixPosition(e.matrixWorld),t.position.copy(Fo),Oo.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Oo),t.updateMatrixWorld(),wr.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(wr,t.coordinateSystem,t.reversedDepth),t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(wr)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Kc extends Wc{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=d*this.view.offsetY,l=o-d*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class nh extends th{constructor(){super(new Kc(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Rr extends jc{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Mt.DEFAULT_UP),this.updateMatrix(),this.target=new Mt,this.shadow=new nh}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class ih extends kt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const Bo=new ot;class sh{constructor(e,t,n=0,s=1/0){this.ray=new $s(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new za,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Bo.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Bo),this}intersectObject(e,t=!0,n=[]){return Aa(e,this,n,t),n.sort(zo),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)Aa(e[s],this,n,t);return n.sort(zo),n}}function zo(i,e){return i.distance-e.distance}function Aa(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let a=0,o=r.length;a<o;a++)Aa(r[a],e,t,!0)}}class ko{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=ze(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(ze(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class rh extends Zu{constructor(e=10,t=10,n=4473924,s=8947848){n=new Fe(n),s=new Fe(s);const r=t/2,a=e/t,o=e/2,l=[],c=[];for(let p=0,m=0,v=-o;p<=t;p++,v+=a){l.push(-o,0,v,o,0,v),l.push(v,0,-o,v,0,o);const x=p===r?n:s;x.toArray(c,m),m+=3,x.toArray(c,m),m+=3,x.toArray(c,m),m+=3,x.toArray(c,m),m+=3}const d=new Ut;d.setAttribute("position",new ct(l,3)),d.setAttribute("color",new ct(c,3));const h=new qc({vertexColors:!0,toneMapped:!1});super(d,h),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}class ah extends Kn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){console.warn("THREE.Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}}function Ho(i,e,t,n){const s=oh(n);switch(t){case Dc:return i*e;case Ic:return i*e/s.components*s.byteLength;case Na:return i*e/s.components*s.byteLength;case Nc:return i*e*2/s.components*s.byteLength;case Ua:return i*e*2/s.components*s.byteLength;case Lc:return i*e*3/s.components*s.byteLength;case Xt:return i*e*4/s.components*s.byteLength;case Fa:return i*e*4/s.components*s.byteLength;case Ls:case Is:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Ns:case Us:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Qr:case ta:return Math.max(i,16)*Math.max(e,8)/4;case Jr:case ea:return Math.max(i,8)*Math.max(e,8)/2;case na:case ia:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case sa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case ra:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case aa:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case oa:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case ca:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case la:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case ua:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case ha:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case da:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case fa:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case pa:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case ma:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case ga:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case _a:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case va:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case xa:case Ma:case ya:return Math.ceil(i/4)*Math.ceil(e/4)*16;case Sa:case Ea:return Math.ceil(i/4)*Math.ceil(e/4)*8;case Ta:case ba:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function oh(i){switch(i){case an:case wc:return{byteLength:1,components:1};case qi:case Rc:case es:return{byteLength:2,components:1};case La:case Ia:return{byteLength:2,components:4};case qn:case Da:case gn:return{byteLength:4,components:1};case Cc:case Pc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Pa}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Pa);function Zc(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function ch(i){const e=new WeakMap;function t(o,l){const c=o.array,d=o.usage,h=c.byteLength,p=i.createBuffer();i.bindBuffer(l,p),i.bufferData(l,c,d),o.onUploadCallback();let m;if(c instanceof Float32Array)m=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)m=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?m=i.HALF_FLOAT:m=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)m=i.SHORT;else if(c instanceof Uint32Array)m=i.UNSIGNED_INT;else if(c instanceof Int32Array)m=i.INT;else if(c instanceof Int8Array)m=i.BYTE;else if(c instanceof Uint8Array)m=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)m=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:p,type:m,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function n(o,l,c){const d=l.array,h=l.updateRanges;if(i.bindBuffer(c,o),h.length===0)i.bufferSubData(c,0,d);else{h.sort((m,v)=>m.start-v.start);let p=0;for(let m=1;m<h.length;m++){const v=h[p],x=h[m];x.start<=v.start+v.count+1?v.count=Math.max(v.count,x.start+x.count-v.start):(++p,h[p]=x)}h.length=p+1;for(let m=0,v=h.length;m<v;m++){const x=h[m];i.bufferSubData(c,x.start*d.BYTES_PER_ELEMENT,d,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const d=e.get(o);(!d||d.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var lh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,uh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,hh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,dh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,fh=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ph=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,mh=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT )
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN )
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,gh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,_h=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,vh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,xh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Mh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,yh=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Sh=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Eh=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Th=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,bh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ah=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,wh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Rh=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Ch=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Ph=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Dh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Lh=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ih=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Nh=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Uh=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Fh=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Oh=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Bh=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,zh="gl_FragColor = linearToOutputTexel( gl_FragColor );",kh=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Hh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Gh=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif

#endif`,Vh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Wh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS

		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Xh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,qh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,$h=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Yh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,jh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Kh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Zh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Jh=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Qh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ed=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,td=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,nd=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,id=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,sd=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,rd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ad=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,od=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,cd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ld=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ud=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,hd=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,dd=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,fd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,pd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,md=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,gd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,_d=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,vd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,xd=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Md=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,yd=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Sd=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ed=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Td=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,bd=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ad=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,wd=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Rd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Cd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Pd=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Dd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ld=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Id=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Nd=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ud=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Fd=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Od=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Bd=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,zd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,kd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Hd=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Gd=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Vd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Wd=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;

		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Xd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,qd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,$d=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Yd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,jd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Kd=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Zd=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Jd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Qd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,ef=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,nf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,sf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,rf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,af=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,of=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,cf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const lf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,uf=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,df=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ff=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,pf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,mf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,gf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,_f=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,vf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,xf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Mf=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,yf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Sf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ef=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Tf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Af=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Rf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Cf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Pf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Df=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,If=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Nf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Uf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ff=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Of=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Bf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,zf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,kf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Hf=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Gf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Be={alphahash_fragment:lh,alphahash_pars_fragment:uh,alphamap_fragment:hh,alphamap_pars_fragment:dh,alphatest_fragment:fh,alphatest_pars_fragment:ph,aomap_fragment:mh,aomap_pars_fragment:gh,batching_pars_vertex:_h,batching_vertex:vh,begin_vertex:xh,beginnormal_vertex:Mh,bsdfs:yh,iridescence_fragment:Sh,bumpmap_pars_fragment:Eh,clipping_planes_fragment:Th,clipping_planes_pars_fragment:bh,clipping_planes_pars_vertex:Ah,clipping_planes_vertex:wh,color_fragment:Rh,color_pars_fragment:Ch,color_pars_vertex:Ph,color_vertex:Dh,common:Lh,cube_uv_reflection_fragment:Ih,defaultnormal_vertex:Nh,displacementmap_pars_vertex:Uh,displacementmap_vertex:Fh,emissivemap_fragment:Oh,emissivemap_pars_fragment:Bh,colorspace_fragment:zh,colorspace_pars_fragment:kh,envmap_fragment:Hh,envmap_common_pars_fragment:Gh,envmap_pars_fragment:Vh,envmap_pars_vertex:Wh,envmap_physical_pars_fragment:td,envmap_vertex:Xh,fog_vertex:qh,fog_pars_vertex:$h,fog_fragment:Yh,fog_pars_fragment:jh,gradientmap_pars_fragment:Kh,lightmap_pars_fragment:Zh,lights_lambert_fragment:Jh,lights_lambert_pars_fragment:Qh,lights_pars_begin:ed,lights_toon_fragment:nd,lights_toon_pars_fragment:id,lights_phong_fragment:sd,lights_phong_pars_fragment:rd,lights_physical_fragment:ad,lights_physical_pars_fragment:od,lights_fragment_begin:cd,lights_fragment_maps:ld,lights_fragment_end:ud,logdepthbuf_fragment:hd,logdepthbuf_pars_fragment:dd,logdepthbuf_pars_vertex:fd,logdepthbuf_vertex:pd,map_fragment:md,map_pars_fragment:gd,map_particle_fragment:_d,map_particle_pars_fragment:vd,metalnessmap_fragment:xd,metalnessmap_pars_fragment:Md,morphinstance_vertex:yd,morphcolor_vertex:Sd,morphnormal_vertex:Ed,morphtarget_pars_vertex:Td,morphtarget_vertex:bd,normal_fragment_begin:Ad,normal_fragment_maps:wd,normal_pars_fragment:Rd,normal_pars_vertex:Cd,normal_vertex:Pd,normalmap_pars_fragment:Dd,clearcoat_normal_fragment_begin:Ld,clearcoat_normal_fragment_maps:Id,clearcoat_pars_fragment:Nd,iridescence_pars_fragment:Ud,opaque_fragment:Fd,packing:Od,premultiplied_alpha_fragment:Bd,project_vertex:zd,dithering_fragment:kd,dithering_pars_fragment:Hd,roughnessmap_fragment:Gd,roughnessmap_pars_fragment:Vd,shadowmap_pars_fragment:Wd,shadowmap_pars_vertex:Xd,shadowmap_vertex:qd,shadowmask_pars_fragment:$d,skinbase_vertex:Yd,skinning_pars_vertex:jd,skinning_vertex:Kd,skinnormal_vertex:Zd,specularmap_fragment:Jd,specularmap_pars_fragment:Qd,tonemapping_fragment:ef,tonemapping_pars_fragment:tf,transmission_fragment:nf,transmission_pars_fragment:sf,uv_pars_fragment:rf,uv_pars_vertex:af,uv_vertex:of,worldpos_vertex:cf,background_vert:lf,background_frag:uf,backgroundCube_vert:hf,backgroundCube_frag:df,cube_vert:ff,cube_frag:pf,depth_vert:mf,depth_frag:gf,distanceRGBA_vert:_f,distanceRGBA_frag:vf,equirect_vert:xf,equirect_frag:Mf,linedashed_vert:yf,linedashed_frag:Sf,meshbasic_vert:Ef,meshbasic_frag:Tf,meshlambert_vert:bf,meshlambert_frag:Af,meshmatcap_vert:wf,meshmatcap_frag:Rf,meshnormal_vert:Cf,meshnormal_frag:Pf,meshphong_vert:Df,meshphong_frag:Lf,meshphysical_vert:If,meshphysical_frag:Nf,meshtoon_vert:Uf,meshtoon_frag:Ff,points_vert:Of,points_frag:Bf,shadow_vert:zf,shadow_frag:kf,sprite_vert:Hf,sprite_frag:Gf},ae={common:{diffuse:{value:new Fe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ue}},envmap:{envMap:{value:null},envMapRotation:{value:new Ue},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ue}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ue}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ue},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ue},normalScale:{value:new De(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ue},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ue}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ue}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ue}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Fe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Fe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0},uvTransform:{value:new Ue}},sprite:{diffuse:{value:new Fe(16777215)},opacity:{value:1},center:{value:new De(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}}},en={basic:{uniforms:bt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.fog]),vertexShader:Be.meshbasic_vert,fragmentShader:Be.meshbasic_frag},lambert:{uniforms:bt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Fe(0)}}]),vertexShader:Be.meshlambert_vert,fragmentShader:Be.meshlambert_frag},phong:{uniforms:bt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Fe(0)},specular:{value:new Fe(1118481)},shininess:{value:30}}]),vertexShader:Be.meshphong_vert,fragmentShader:Be.meshphong_frag},standard:{uniforms:bt([ae.common,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.roughnessmap,ae.metalnessmap,ae.fog,ae.lights,{emissive:{value:new Fe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag},toon:{uniforms:bt([ae.common,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.gradientmap,ae.fog,ae.lights,{emissive:{value:new Fe(0)}}]),vertexShader:Be.meshtoon_vert,fragmentShader:Be.meshtoon_frag},matcap:{uniforms:bt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,{matcap:{value:null}}]),vertexShader:Be.meshmatcap_vert,fragmentShader:Be.meshmatcap_frag},points:{uniforms:bt([ae.points,ae.fog]),vertexShader:Be.points_vert,fragmentShader:Be.points_frag},dashed:{uniforms:bt([ae.common,ae.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Be.linedashed_vert,fragmentShader:Be.linedashed_frag},depth:{uniforms:bt([ae.common,ae.displacementmap]),vertexShader:Be.depth_vert,fragmentShader:Be.depth_frag},normal:{uniforms:bt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,{opacity:{value:1}}]),vertexShader:Be.meshnormal_vert,fragmentShader:Be.meshnormal_frag},sprite:{uniforms:bt([ae.sprite,ae.fog]),vertexShader:Be.sprite_vert,fragmentShader:Be.sprite_frag},background:{uniforms:{uvTransform:{value:new Ue},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Be.background_vert,fragmentShader:Be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ue}},vertexShader:Be.backgroundCube_vert,fragmentShader:Be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Be.cube_vert,fragmentShader:Be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Be.equirect_vert,fragmentShader:Be.equirect_frag},distanceRGBA:{uniforms:bt([ae.common,ae.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Be.distanceRGBA_vert,fragmentShader:Be.distanceRGBA_frag},shadow:{uniforms:bt([ae.lights,ae.fog,{color:{value:new Fe(0)},opacity:{value:1}}]),vertexShader:Be.shadow_vert,fragmentShader:Be.shadow_frag}};en.physical={uniforms:bt([en.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ue},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ue},clearcoatNormalScale:{value:new De(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ue},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ue},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ue},sheen:{value:0},sheenColor:{value:new Fe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ue},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ue},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ue},transmissionSamplerSize:{value:new De},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ue},attenuationDistance:{value:0},attenuationColor:{value:new Fe(0)},specularColor:{value:new Fe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ue},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ue},anisotropyVector:{value:new De},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ue}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag};const bs={r:0,b:0,g:0},zn=new on,Vf=new ot;function Wf(i,e,t,n,s,r,a){const o=new Fe(0);let l=r===!0?0:1,c,d,h=null,p=0,m=null;function v(b){let E=b.isScene===!0?b.background:null;return E&&E.isTexture&&(E=(b.backgroundBlurriness>0?t:e).get(E)),E}function x(b){let E=!1;const D=v(b);D===null?u(o,l):D&&D.isColor&&(u(D,1),E=!0);const R=i.xr.getEnvironmentBlendMode();R==="additive"?n.buffers.color.setClear(0,0,0,1,a):R==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||E)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function g(b,E){const D=v(E);D&&(D.isCubeTexture||D.mapping===Xs)?(d===void 0&&(d=new it(new wi(1,1,1),new Dn({name:"BackgroundCubeMaterial",uniforms:Ti(en.backgroundCube.uniforms),vertexShader:en.backgroundCube.vertexShader,fragmentShader:en.backgroundCube.fragmentShader,side:Ct,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),d.geometry.deleteAttribute("normal"),d.geometry.deleteAttribute("uv"),d.onBeforeRender=function(R,P,U){this.matrixWorld.copyPosition(U.matrixWorld)},Object.defineProperty(d.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(d)),zn.copy(E.backgroundRotation),zn.x*=-1,zn.y*=-1,zn.z*=-1,D.isCubeTexture&&D.isRenderTargetTexture===!1&&(zn.y*=-1,zn.z*=-1),d.material.uniforms.envMap.value=D,d.material.uniforms.flipEnvMap.value=D.isCubeTexture&&D.isRenderTargetTexture===!1?-1:1,d.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,d.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,d.material.uniforms.backgroundRotation.value.setFromMatrix4(Vf.makeRotationFromEuler(zn)),d.material.toneMapped=qe.getTransfer(D.colorSpace)!==Ze,(h!==D||p!==D.version||m!==i.toneMapping)&&(d.material.needsUpdate=!0,h=D,p=D.version,m=i.toneMapping),d.layers.enableAll(),b.unshift(d,d.geometry,d.material,0,0,null)):D&&D.isTexture&&(c===void 0&&(c=new it(new js(2,2),new Dn({name:"BackgroundMaterial",uniforms:Ti(en.background.uniforms),vertexShader:en.background.vertexShader,fragmentShader:en.background.fragmentShader,side:Pn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=D,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.toneMapped=qe.getTransfer(D.colorSpace)!==Ze,D.matrixAutoUpdate===!0&&D.updateMatrix(),c.material.uniforms.uvTransform.value.copy(D.matrix),(h!==D||p!==D.version||m!==i.toneMapping)&&(c.material.needsUpdate=!0,h=D,p=D.version,m=i.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null))}function u(b,E){b.getRGB(bs,Vc(i)),n.buffers.color.setClear(bs.r,bs.g,bs.b,E,a)}function A(){d!==void 0&&(d.geometry.dispose(),d.material.dispose(),d=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(b,E=1){o.set(b),l=E,u(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(b){l=b,u(o,l)},render:x,addToRenderList:g,dispose:A}}function Xf(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=p(null);let r=s,a=!1;function o(S,C,B,k,$){let q=!1;const X=h(k,B,C);r!==X&&(r=X,c(r.object)),q=m(S,k,B,$),q&&v(S,k,B,$),$!==null&&e.update($,i.ELEMENT_ARRAY_BUFFER),(q||a)&&(a=!1,E(S,C,B,k),$!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get($).buffer))}function l(){return i.createVertexArray()}function c(S){return i.bindVertexArray(S)}function d(S){return i.deleteVertexArray(S)}function h(S,C,B){const k=B.wireframe===!0;let $=n[S.id];$===void 0&&($={},n[S.id]=$);let q=$[C.id];q===void 0&&(q={},$[C.id]=q);let X=q[k];return X===void 0&&(X=p(l()),q[k]=X),X}function p(S){const C=[],B=[],k=[];for(let $=0;$<t;$++)C[$]=0,B[$]=0,k[$]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:B,attributeDivisors:k,object:S,attributes:{},index:null}}function m(S,C,B,k){const $=r.attributes,q=C.attributes;let X=0;const Z=B.getAttributes();for(const W in Z)if(Z[W].location>=0){const ue=$[W];let ve=q[W];if(ve===void 0&&(W==="instanceMatrix"&&S.instanceMatrix&&(ve=S.instanceMatrix),W==="instanceColor"&&S.instanceColor&&(ve=S.instanceColor)),ue===void 0||ue.attribute!==ve||ve&&ue.data!==ve.data)return!0;X++}return r.attributesNum!==X||r.index!==k}function v(S,C,B,k){const $={},q=C.attributes;let X=0;const Z=B.getAttributes();for(const W in Z)if(Z[W].location>=0){let ue=q[W];ue===void 0&&(W==="instanceMatrix"&&S.instanceMatrix&&(ue=S.instanceMatrix),W==="instanceColor"&&S.instanceColor&&(ue=S.instanceColor));const ve={};ve.attribute=ue,ue&&ue.data&&(ve.data=ue.data),$[W]=ve,X++}r.attributes=$,r.attributesNum=X,r.index=k}function x(){const S=r.newAttributes;for(let C=0,B=S.length;C<B;C++)S[C]=0}function g(S){u(S,0)}function u(S,C){const B=r.newAttributes,k=r.enabledAttributes,$=r.attributeDivisors;B[S]=1,k[S]===0&&(i.enableVertexAttribArray(S),k[S]=1),$[S]!==C&&(i.vertexAttribDivisor(S,C),$[S]=C)}function A(){const S=r.newAttributes,C=r.enabledAttributes;for(let B=0,k=C.length;B<k;B++)C[B]!==S[B]&&(i.disableVertexAttribArray(B),C[B]=0)}function b(S,C,B,k,$,q,X){X===!0?i.vertexAttribIPointer(S,C,B,$,q):i.vertexAttribPointer(S,C,B,k,$,q)}function E(S,C,B,k){x();const $=k.attributes,q=B.getAttributes(),X=C.defaultAttributeValues;for(const Z in q){const W=q[Z];if(W.location>=0){let se=$[Z];if(se===void 0&&(Z==="instanceMatrix"&&S.instanceMatrix&&(se=S.instanceMatrix),Z==="instanceColor"&&S.instanceColor&&(se=S.instanceColor)),se!==void 0){const ue=se.normalized,ve=se.itemSize,Ie=e.get(se);if(Ie===void 0)continue;const We=Ie.buffer,$e=Ie.type,Ve=Ie.bytesPerElement,Y=$e===i.INT||$e===i.UNSIGNED_INT||se.gpuType===Da;if(se.isInterleavedBufferAttribute){const j=se.data,pe=j.stride,be=se.offset;if(j.isInstancedInterleavedBuffer){for(let xe=0;xe<W.locationSize;xe++)u(W.location+xe,j.meshPerAttribute);S.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let xe=0;xe<W.locationSize;xe++)g(W.location+xe);i.bindBuffer(i.ARRAY_BUFFER,We);for(let xe=0;xe<W.locationSize;xe++)b(W.location+xe,ve/W.locationSize,$e,ue,pe*Ve,(be+ve/W.locationSize*xe)*Ve,Y)}else{if(se.isInstancedBufferAttribute){for(let j=0;j<W.locationSize;j++)u(W.location+j,se.meshPerAttribute);S.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=se.meshPerAttribute*se.count)}else for(let j=0;j<W.locationSize;j++)g(W.location+j);i.bindBuffer(i.ARRAY_BUFFER,We);for(let j=0;j<W.locationSize;j++)b(W.location+j,ve/W.locationSize,$e,ue,ve*Ve,ve/W.locationSize*j*Ve,Y)}}else if(X!==void 0){const ue=X[Z];if(ue!==void 0)switch(ue.length){case 2:i.vertexAttrib2fv(W.location,ue);break;case 3:i.vertexAttrib3fv(W.location,ue);break;case 4:i.vertexAttrib4fv(W.location,ue);break;default:i.vertexAttrib1fv(W.location,ue)}}}}A()}function D(){U();for(const S in n){const C=n[S];for(const B in C){const k=C[B];for(const $ in k)d(k[$].object),delete k[$];delete C[B]}delete n[S]}}function R(S){if(n[S.id]===void 0)return;const C=n[S.id];for(const B in C){const k=C[B];for(const $ in k)d(k[$].object),delete k[$];delete C[B]}delete n[S.id]}function P(S){for(const C in n){const B=n[C];if(B[S.id]===void 0)continue;const k=B[S.id];for(const $ in k)d(k[$].object),delete k[$];delete B[S.id]}}function U(){T(),a=!0,r!==s&&(r=s,c(r.object))}function T(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:U,resetDefaultState:T,dispose:D,releaseStatesOfGeometry:R,releaseStatesOfProgram:P,initAttributes:x,enableAttribute:g,disableUnusedAttributes:A}}function qf(i,e,t){let n;function s(c){n=c}function r(c,d){i.drawArrays(n,c,d),t.update(d,n,1)}function a(c,d,h){h!==0&&(i.drawArraysInstanced(n,c,d,h),t.update(d,n,h))}function o(c,d,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,d,0,h);let m=0;for(let v=0;v<h;v++)m+=d[v];t.update(m,n,1)}function l(c,d,h,p){if(h===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let v=0;v<c.length;v++)a(c[v],d[v],p[v]);else{m.multiDrawArraysInstancedWEBGL(n,c,0,d,0,p,0,h);let v=0;for(let x=0;x<h;x++)v+=d[x]*p[x];t.update(v,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function $f(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const P=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(P){return!(P!==Xt&&n.convert(P)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(P){const U=P===es&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(P!==an&&n.convert(P)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&P!==gn&&!U)}function l(P){if(P==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const d=l(c);d!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",d,"instead."),c=d);const h=t.logarithmicDepthBuffer===!0,p=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),m=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_TEXTURE_SIZE),g=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),u=i.getParameter(i.MAX_VERTEX_ATTRIBS),A=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),E=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),D=v>0,R=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:p,maxTextures:m,maxVertexTextures:v,maxTextureSize:x,maxCubemapSize:g,maxAttributes:u,maxVertexUniforms:A,maxVaryings:b,maxFragmentUniforms:E,vertexTextures:D,maxSamples:R}}function Yf(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new An,o=new Ue,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,p){const m=h.length!==0||p||n!==0||s;return s=p,n=h.length,m},this.beginShadows=function(){r=!0,d(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,p){t=d(h,p,0)},this.setState=function(h,p,m){const v=h.clippingPlanes,x=h.clipIntersection,g=h.clipShadows,u=i.get(h);if(!s||v===null||v.length===0||r&&!g)r?d(null):c();else{const A=r?0:n,b=A*4;let E=u.clippingState||null;l.value=E,E=d(v,p,b,m);for(let D=0;D!==b;++D)E[D]=t[D];u.clippingState=E,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=A}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function d(h,p,m,v){const x=h!==null?h.length:0;let g=null;if(x!==0){if(g=l.value,v!==!0||g===null){const u=m+x*4,A=p.matrixWorldInverse;o.getNormalMatrix(A),(g===null||g.length<u)&&(g=new Float32Array(u));for(let b=0,E=m;b!==x;++b,E+=4)a.copy(h[b]).applyMatrix4(A,o),a.normal.toArray(g,E),g[E+3]=a.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,g}}function jf(i){let e=new WeakMap;function t(a,o){return o===Yr?a.mapping=yi:o===jr&&(a.mapping=Si),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Yr||o===jr)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Wu(l.height);return c.fromEquirectangularTexture(i,a),e.set(a,c),a.addEventListener("dispose",s),t(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}const mi=4,Go=[.125,.215,.35,.446,.526,.582],Vn=20,Cr=new Kc,Vo=new Fe;let Pr=null,Dr=0,Lr=0,Ir=!1;const Hn=(1+Math.sqrt(5))/2,di=1/Hn,Wo=[new N(-Hn,di,0),new N(Hn,di,0),new N(-di,0,Hn),new N(di,0,Hn),new N(0,Hn,-di),new N(0,Hn,di),new N(-1,1,-1),new N(1,1,-1),new N(-1,1,1),new N(1,1,1)],Kf=new N;class Xo{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=Kf}=r;Pr=this._renderer.getRenderTarget(),Dr=this._renderer.getActiveCubeFace(),Lr=this._renderer.getActiveMipmapLevel(),Ir=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Yo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=$o(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Pr,Dr,Lr),this._renderer.xr.enabled=Ir,e.scissorTest=!1,As(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===yi||e.mapping===Si?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Pr=this._renderer.getRenderTarget(),Dr=this._renderer.getActiveCubeFace(),Lr=this._renderer.getActiveMipmapLevel(),Ir=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:tn,minFilter:tn,generateMipmaps:!1,type:es,format:Xt,colorSpace:Ei,depthBuffer:!1},s=qo(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=qo(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Zf(r)),this._blurMaterial=Jf(r,e,t)}return s}_compileMaterial(e){const t=new it(this._lodPlanes[0],e);this._renderer.compile(t,Cr)}_sceneToCubeUV(e,t,n,s,r){const l=new kt(90,1,t,n),c=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],h=this._renderer,p=h.autoClear,m=h.toneMapping;h.getClearColor(Vo),h.toneMapping=Cn,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(s),h.clearDepth(),h.setRenderTarget(null));const x=new kc({name:"PMREM.Background",side:Ct,depthWrite:!1,depthTest:!1}),g=new it(new wi,x);let u=!1;const A=e.background;A?A.isColor&&(x.color.copy(A),e.background=null,u=!0):(x.color.copy(Vo),u=!0);for(let b=0;b<6;b++){const E=b%3;E===0?(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+d[b],r.y,r.z)):E===1?(l.up.set(0,0,c[b]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+d[b],r.z)):(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+d[b]));const D=this._cubeSize;As(s,E*D,b>2?D:0,D,D),h.setRenderTarget(s),u&&h.render(g,l),h.render(e,l)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=m,h.autoClear=p,e.background=A}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===yi||e.mapping===Si;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Yo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=$o());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new it(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;As(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,Cr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Wo[(s-r-1)%Wo.length];this._blur(e,r-1,r,a,o)}t.autoClear=n}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const d=3,h=new it(this._lodPlanes[s],c),p=c.uniforms,m=this._sizeLods[n]-1,v=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*Vn-1),x=r/v,g=isFinite(r)?1+Math.floor(d*x):Vn;g>Vn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${Vn}`);const u=[];let A=0;for(let P=0;P<Vn;++P){const U=P/x,T=Math.exp(-U*U/2);u.push(T),P===0?A+=T:P<g&&(A+=2*T)}for(let P=0;P<u.length;P++)u[P]=u[P]/A;p.envMap.value=e.texture,p.samples.value=g,p.weights.value=u,p.latitudinal.value=a==="latitudinal",o&&(p.poleAxis.value=o);const{_lodMax:b}=this;p.dTheta.value=v,p.mipInt.value=b-n;const E=this._sizeLods[s],D=3*E*(s>b-mi?s-b+mi:0),R=4*(this._cubeSize-E);As(t,D,R,3*E,2*E),l.setRenderTarget(t),l.render(h,Cr)}}function Zf(i){const e=[],t=[],n=[];let s=i;const r=i-mi+1+Go.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);t.push(o);let l=1/o;a>i-mi?l=Go[a-i+mi-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),d=-c,h=1+c,p=[d,d,h,d,h,h,d,d,h,h,d,h],m=6,v=6,x=3,g=2,u=1,A=new Float32Array(x*v*m),b=new Float32Array(g*v*m),E=new Float32Array(u*v*m);for(let R=0;R<m;R++){const P=R%3*2/3-1,U=R>2?0:-1,T=[P,U,0,P+2/3,U,0,P+2/3,U+1,0,P,U,0,P+2/3,U+1,0,P,U+1,0];A.set(T,x*v*R),b.set(p,g*v*R);const S=[R,R,R,R,R,R];E.set(S,u*v*R)}const D=new Ut;D.setAttribute("position",new rn(A,x)),D.setAttribute("uv",new rn(b,g)),D.setAttribute("faceIndex",new rn(E,u)),e.push(D),s>mi&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function qo(i,e,t){const n=new Yn(i,e,t);return n.texture.mapping=Xs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function As(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function Jf(i,e,t){const n=new Float32Array(Vn),s=new N(0,1,0);return new Dn({name:"SphericalGaussianBlur",defines:{n:Vn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Wa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function $o(){return new Dn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Wa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function Yo(){return new Dn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Wa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Rn,depthTest:!1,depthWrite:!1})}function Wa(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Qf(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Yr||l===jr,d=l===yi||l===Si;if(c||d){let h=e.get(o);const p=h!==void 0?h.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==p)return t===null&&(t=new Xo(i)),h=c?t.fromEquirectangular(o,h):t.fromCubemap(o,h),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),h.texture;if(h!==void 0)return h.texture;{const m=o.image;return c&&m&&m.height>0||d&&m&&s(m)?(t===null&&(t=new Xo(i)),h=c?t.fromEquirectangular(o):t.fromCubemap(o),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),o.addEventListener("dispose",r),h.texture):null}}}return o}function s(o){let l=0;const c=6;for(let d=0;d<c;d++)o[d]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function ep(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Zi("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function tp(i,e,t,n){const s={},r=new WeakMap;function a(h){const p=h.target;p.index!==null&&e.remove(p.index);for(const v in p.attributes)e.remove(p.attributes[v]);p.removeEventListener("dispose",a),delete s[p.id];const m=r.get(p);m&&(e.remove(m),r.delete(p)),n.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function o(h,p){return s[p.id]===!0||(p.addEventListener("dispose",a),s[p.id]=!0,t.memory.geometries++),p}function l(h){const p=h.attributes;for(const m in p)e.update(p[m],i.ARRAY_BUFFER)}function c(h){const p=[],m=h.index,v=h.attributes.position;let x=0;if(m!==null){const A=m.array;x=m.version;for(let b=0,E=A.length;b<E;b+=3){const D=A[b+0],R=A[b+1],P=A[b+2];p.push(D,R,R,P,P,D)}}else if(v!==void 0){const A=v.array;x=v.version;for(let b=0,E=A.length/3-1;b<E;b+=3){const D=b+0,R=b+1,P=b+2;p.push(D,R,R,P,P,D)}}else return;const g=new(Oc(p)?Gc:Hc)(p,1);g.version=x;const u=r.get(h);u&&e.remove(u),r.set(h,g)}function d(h){const p=r.get(h);if(p){const m=h.index;m!==null&&p.version<m.version&&c(h)}else c(h);return r.get(h)}return{get:o,update:l,getWireframeAttribute:d}}function np(i,e,t){let n;function s(p){n=p}let r,a;function o(p){r=p.type,a=p.bytesPerElement}function l(p,m){i.drawElements(n,m,r,p*a),t.update(m,n,1)}function c(p,m,v){v!==0&&(i.drawElementsInstanced(n,m,r,p*a,v),t.update(m,n,v))}function d(p,m,v){if(v===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,m,0,r,p,0,v);let g=0;for(let u=0;u<v;u++)g+=m[u];t.update(g,n,1)}function h(p,m,v,x){if(v===0)return;const g=e.get("WEBGL_multi_draw");if(g===null)for(let u=0;u<p.length;u++)c(p[u]/a,m[u],x[u]);else{g.multiDrawElementsInstancedWEBGL(n,m,0,r,p,0,x,0,v);let u=0;for(let A=0;A<v;A++)u+=m[A]*x[A];t.update(u,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=d,this.renderMultiDrawInstances=h}function ip(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function sp(i,e,t){const n=new WeakMap,s=new ut;function r(a,o,l){const c=a.morphTargetInfluences,d=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=d!==void 0?d.length:0;let p=n.get(o);if(p===void 0||p.count!==h){let S=function(){U.dispose(),n.delete(o),o.removeEventListener("dispose",S)};var m=S;p!==void 0&&p.texture.dispose();const v=o.morphAttributes.position!==void 0,x=o.morphAttributes.normal!==void 0,g=o.morphAttributes.color!==void 0,u=o.morphAttributes.position||[],A=o.morphAttributes.normal||[],b=o.morphAttributes.color||[];let E=0;v===!0&&(E=1),x===!0&&(E=2),g===!0&&(E=3);let D=o.attributes.position.count*E,R=1;D>e.maxTextureSize&&(R=Math.ceil(D/e.maxTextureSize),D=e.maxTextureSize);const P=new Float32Array(D*R*4*h),U=new Bc(P,D,R,h);U.type=gn,U.needsUpdate=!0;const T=E*4;for(let C=0;C<h;C++){const B=u[C],k=A[C],$=b[C],q=D*R*4*C;for(let X=0;X<B.count;X++){const Z=X*T;v===!0&&(s.fromBufferAttribute(B,X),P[q+Z+0]=s.x,P[q+Z+1]=s.y,P[q+Z+2]=s.z,P[q+Z+3]=0),x===!0&&(s.fromBufferAttribute(k,X),P[q+Z+4]=s.x,P[q+Z+5]=s.y,P[q+Z+6]=s.z,P[q+Z+7]=0),g===!0&&(s.fromBufferAttribute($,X),P[q+Z+8]=s.x,P[q+Z+9]=s.y,P[q+Z+10]=s.z,P[q+Z+11]=$.itemSize===4?s.w:1)}}p={count:h,texture:U,size:new De(D,R)},n.set(o,p),o.addEventListener("dispose",S)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let v=0;for(let g=0;g<c.length;g++)v+=c[g];const x=o.morphTargetsRelative?1:1-v;l.getUniforms().setValue(i,"morphTargetBaseInfluence",x),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",p.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",p.size)}return{update:r}}function rp(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,d=l.geometry,h=e.get(l,d);if(s.get(h)!==c&&(e.update(h),s.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const p=l.skeleton;s.get(p)!==c&&(p.update(),s.set(p,c))}return h}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}const Jc=new At,jo=new $c(1,1),Qc=new Bc,el=new wu,tl=new Xc,Ko=[],Zo=[],Jo=new Float32Array(16),Qo=new Float32Array(9),ec=new Float32Array(4);function Ri(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Ko[s];if(r===void 0&&(r=new Float32Array(s),Ko[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function gt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function _t(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Zs(i,e){let t=Zo[e];t===void 0&&(t=new Int32Array(e),Zo[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function ap(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function op(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2fv(this.addr,e),_t(t,e)}}function cp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(gt(t,e))return;i.uniform3fv(this.addr,e),_t(t,e)}}function lp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4fv(this.addr,e),_t(t,e)}}function up(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;ec.set(n),i.uniformMatrix2fv(this.addr,!1,ec),_t(t,n)}}function hp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;Qo.set(n),i.uniformMatrix3fv(this.addr,!1,Qo),_t(t,n)}}function dp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),_t(t,e)}else{if(gt(t,n))return;Jo.set(n),i.uniformMatrix4fv(this.addr,!1,Jo),_t(t,n)}}function fp(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function pp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2iv(this.addr,e),_t(t,e)}}function mp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3iv(this.addr,e),_t(t,e)}}function gp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4iv(this.addr,e),_t(t,e)}}function _p(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function vp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2uiv(this.addr,e),_t(t,e)}}function xp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3uiv(this.addr,e),_t(t,e)}}function Mp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4uiv(this.addr,e),_t(t,e)}}function yp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(jo.compareFunction=Fc,r=jo):r=Jc,t.setTexture2D(e||r,s)}function Sp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||el,s)}function Ep(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||tl,s)}function Tp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||Qc,s)}function bp(i){switch(i){case 5126:return ap;case 35664:return op;case 35665:return cp;case 35666:return lp;case 35674:return up;case 35675:return hp;case 35676:return dp;case 5124:case 35670:return fp;case 35667:case 35671:return pp;case 35668:case 35672:return mp;case 35669:case 35673:return gp;case 5125:return _p;case 36294:return vp;case 36295:return xp;case 36296:return Mp;case 35678:case 36198:case 36298:case 36306:case 35682:return yp;case 35679:case 36299:case 36307:return Sp;case 35680:case 36300:case 36308:case 36293:return Ep;case 36289:case 36303:case 36311:case 36292:return Tp}}function Ap(i,e){i.uniform1fv(this.addr,e)}function wp(i,e){const t=Ri(e,this.size,2);i.uniform2fv(this.addr,t)}function Rp(i,e){const t=Ri(e,this.size,3);i.uniform3fv(this.addr,t)}function Cp(i,e){const t=Ri(e,this.size,4);i.uniform4fv(this.addr,t)}function Pp(i,e){const t=Ri(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Dp(i,e){const t=Ri(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Lp(i,e){const t=Ri(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Ip(i,e){i.uniform1iv(this.addr,e)}function Np(i,e){i.uniform2iv(this.addr,e)}function Up(i,e){i.uniform3iv(this.addr,e)}function Fp(i,e){i.uniform4iv(this.addr,e)}function Op(i,e){i.uniform1uiv(this.addr,e)}function Bp(i,e){i.uniform2uiv(this.addr,e)}function zp(i,e){i.uniform3uiv(this.addr,e)}function kp(i,e){i.uniform4uiv(this.addr,e)}function Hp(i,e,t){const n=this.cache,s=e.length,r=Zs(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTexture2D(e[a]||Jc,r[a])}function Gp(i,e,t){const n=this.cache,s=e.length,r=Zs(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||el,r[a])}function Vp(i,e,t){const n=this.cache,s=e.length,r=Zs(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||tl,r[a])}function Wp(i,e,t){const n=this.cache,s=e.length,r=Zs(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),_t(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Qc,r[a])}function Xp(i){switch(i){case 5126:return Ap;case 35664:return wp;case 35665:return Rp;case 35666:return Cp;case 35674:return Pp;case 35675:return Dp;case 35676:return Lp;case 5124:case 35670:return Ip;case 35667:case 35671:return Np;case 35668:case 35672:return Up;case 35669:case 35673:return Fp;case 5125:return Op;case 36294:return Bp;case 36295:return zp;case 36296:return kp;case 35678:case 36198:case 36298:case 36306:case 35682:return Hp;case 35679:case 36299:case 36307:return Gp;case 35680:case 36300:case 36308:case 36293:return Vp;case 36289:case 36303:case 36311:case 36292:return Wp}}class qp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=bp(t.type)}}class $p{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Xp(t.type)}}class Yp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const Nr=/(\w+)(\])?(\[|\.)?/g;function tc(i,e){i.seq.push(e),i.map[e.id]=e}function jp(i,e,t){const n=i.name,s=n.length;for(Nr.lastIndex=0;;){const r=Nr.exec(n),a=Nr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){tc(t,c===void 0?new qp(o,i,e):new $p(o,i,e));break}else{let h=t.map[o];h===void 0&&(h=new Yp(o),tc(t,h)),t=h}}}class Fs{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),a=e.getUniformLocation(t,r.name);jp(r,a,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function nc(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Kp=37297;let Zp=0;function Jp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const ic=new Ue;function Qp(i){qe._getMatrix(ic,qe.workingColorSpace,i);const e=`mat3( ${ic.elements.map(t=>t.toFixed(4))} )`;switch(qe.getTransfer(i)){case zs:return[e,"LinearTransferOETF"];case Ze:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function sc(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Jp(i.getShaderSource(e),o)}else return r}function em(i,e){const t=Qp(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function tm(i,e){let t;switch(e){case Hl:t="Linear";break;case Gl:t="Reinhard";break;case Vl:t="Cineon";break;case bc:t="ACESFilmic";break;case Xl:t="AgX";break;case ql:t="Neutral";break;case Wl:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const ws=new N;function nm(){qe.getLuminanceCoefficients(ws);const i=ws.x.toFixed(4),e=ws.y.toFixed(4),t=ws.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function im(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ki).join(`
`)}function sm(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function rm(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function ki(i){return i!==""}function rc(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ac(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const am=/^[ \t]*#include +<([\w\d./]+)>/gm;function wa(i){return i.replace(am,cm)}const om=new Map;function cm(i,e){let t=Be[e];if(t===void 0){const n=om.get(e);if(n!==void 0)t=Be[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return wa(t)}const lm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function oc(i){return i.replace(lm,um)}function um(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function cc(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function hm(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Sc?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===Ec?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===pn&&(e="SHADOWMAP_TYPE_VSM"),e}function dm(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case yi:case Si:e="ENVMAP_TYPE_CUBE";break;case Xs:e="ENVMAP_TYPE_CUBE_UV";break}return e}function fm(i){let e="ENVMAP_MODE_REFLECTION";return i.envMap&&i.envMapMode===Si&&(e="ENVMAP_MODE_REFRACTION"),e}function pm(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Tc:e="ENVMAP_BLENDING_MULTIPLY";break;case zl:e="ENVMAP_BLENDING_MIX";break;case kl:e="ENVMAP_BLENDING_ADD";break}return e}function mm(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function gm(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=hm(t),c=dm(t),d=fm(t),h=pm(t),p=mm(t),m=im(t),v=sm(r),x=s.createProgram();let g,u,A=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter(ki).join(`
`),g.length>0&&(g+=`
`),u=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter(ki).join(`
`),u.length>0&&(u+=`
`)):(g=[cc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ki).join(`
`),u=[cc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+d:"",t.envMap?"#define "+h:"",p?"#define CUBEUV_TEXEL_WIDTH "+p.texelWidth:"",p?"#define CUBEUV_TEXEL_HEIGHT "+p.texelHeight:"",p?"#define CUBEUV_MAX_MIP "+p.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Cn?"#define TONE_MAPPING":"",t.toneMapping!==Cn?Be.tonemapping_pars_fragment:"",t.toneMapping!==Cn?tm("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Be.colorspace_pars_fragment,em("linearToOutputTexel",t.outputColorSpace),nm(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ki).join(`
`)),a=wa(a),a=rc(a,t),a=ac(a,t),o=wa(o),o=rc(o,t),o=ac(o,t),a=oc(a),o=oc(o),t.isRawShaderMaterial!==!0&&(A=`#version 300 es
`,g=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,u=["#define varying in",t.glslVersion===fo?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===fo?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+u);const b=A+g+a,E=A+u+o,D=nc(s,s.VERTEX_SHADER,b),R=nc(s,s.FRAGMENT_SHADER,E);s.attachShader(x,D),s.attachShader(x,R),t.index0AttributeName!==void 0?s.bindAttribLocation(x,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(x,0,"position"),s.linkProgram(x);function P(C){if(i.debug.checkShaderErrors){const B=s.getProgramInfoLog(x)||"",k=s.getShaderInfoLog(D)||"",$=s.getShaderInfoLog(R)||"",q=B.trim(),X=k.trim(),Z=$.trim();let W=!0,se=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(W=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,x,D,R);else{const ue=sc(s,D,"vertex"),ve=sc(s,R,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+q+`
`+ue+`
`+ve)}else q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",q):(X===""||Z==="")&&(se=!1);se&&(C.diagnostics={runnable:W,programLog:q,vertexShader:{log:X,prefix:g},fragmentShader:{log:Z,prefix:u}})}s.deleteShader(D),s.deleteShader(R),U=new Fs(s,x),T=rm(s,x)}let U;this.getUniforms=function(){return U===void 0&&P(this),U};let T;this.getAttributes=function(){return T===void 0&&P(this),T};let S=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return S===!1&&(S=s.getProgramParameter(x,Kp)),S},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Zp++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=D,this.fragmentShader=R,this}let _m=0;class vm{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new xm(e),t.set(e,n)),n}}class xm{constructor(e){this.id=_m++,this.code=e,this.usedTimes=0}}function Mm(i,e,t,n,s,r,a){const o=new za,l=new vm,c=new Set,d=[],h=s.logarithmicDepthBuffer,p=s.vertexTextures;let m=s.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(T){return c.add(T),T===0?"uv":`uv${T}`}function g(T,S,C,B,k){const $=B.fog,q=k.geometry,X=T.isMeshStandardMaterial?B.environment:null,Z=(T.isMeshStandardMaterial?t:e).get(T.envMap||X),W=Z&&Z.mapping===Xs?Z.image.height:null,se=v[T.type];T.precision!==null&&(m=s.getMaxPrecision(T.precision),m!==T.precision&&console.warn("THREE.WebGLProgram.getParameters:",T.precision,"not supported, using",m,"instead."));const ue=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,ve=ue!==void 0?ue.length:0;let Ie=0;q.morphAttributes.position!==void 0&&(Ie=1),q.morphAttributes.normal!==void 0&&(Ie=2),q.morphAttributes.color!==void 0&&(Ie=3);let We,$e,Ve,Y;if(se){const je=en[se];We=je.vertexShader,$e=je.fragmentShader}else We=T.vertexShader,$e=T.fragmentShader,l.update(T),Ve=l.getVertexShaderID(T),Y=l.getFragmentShaderID(T);const j=i.getRenderTarget(),pe=i.state.buffers.depth.getReversed(),be=k.isInstancedMesh===!0,xe=k.isBatchedMesh===!0,He=!!T.map,vt=!!T.matcap,w=!!Z,et=!!T.aoMap,Pe=!!T.lightMap,Se=!!T.bumpMap,ge=!!T.normalMap,Ye=!!T.displacementMap,de=!!T.emissiveMap,Ne=!!T.metalnessMap,ht=!!T.roughnessMap,st=T.anisotropy>0,_=T.clearcoat>0,f=T.dispersion>0,y=T.iridescence>0,L=T.sheen>0,z=T.transmission>0,H=st&&!!T.anisotropyMap,ie=_&&!!T.clearcoatMap,ee=_&&!!T.clearcoatNormalMap,he=_&&!!T.clearcoatRoughnessMap,Me=y&&!!T.iridescenceMap,J=y&&!!T.iridescenceThicknessMap,le=L&&!!T.sheenColorMap,Re=L&&!!T.sheenRoughnessMap,Ee=!!T.specularMap,oe=!!T.specularColorMap,Oe=!!T.specularIntensityMap,I=z&&!!T.transmissionMap,ne=z&&!!T.thicknessMap,re=!!T.gradientMap,me=!!T.alphaMap,Q=T.alphaTest>0,K=!!T.alphaHash,ye=!!T.extensions;let Le=Cn;T.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Le=i.toneMapping);const tt={shaderID:se,shaderType:T.type,shaderName:T.name,vertexShader:We,fragmentShader:$e,defines:T.defines,customVertexShaderID:Ve,customFragmentShaderID:Y,isRawShaderMaterial:T.isRawShaderMaterial===!0,glslVersion:T.glslVersion,precision:m,batching:xe,batchingColor:xe&&k._colorsTexture!==null,instancing:be,instancingColor:be&&k.instanceColor!==null,instancingMorph:be&&k.morphTexture!==null,supportsVertexTextures:p,outputColorSpace:j===null?i.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Ei,alphaToCoverage:!!T.alphaToCoverage,map:He,matcap:vt,envMap:w,envMapMode:w&&Z.mapping,envMapCubeUVHeight:W,aoMap:et,lightMap:Pe,bumpMap:Se,normalMap:ge,displacementMap:p&&Ye,emissiveMap:de,normalMapObjectSpace:ge&&T.normalMapType===Kl,normalMapTangentSpace:ge&&T.normalMapType===Uc,metalnessMap:Ne,roughnessMap:ht,anisotropy:st,anisotropyMap:H,clearcoat:_,clearcoatMap:ie,clearcoatNormalMap:ee,clearcoatRoughnessMap:he,dispersion:f,iridescence:y,iridescenceMap:Me,iridescenceThicknessMap:J,sheen:L,sheenColorMap:le,sheenRoughnessMap:Re,specularMap:Ee,specularColorMap:oe,specularIntensityMap:Oe,transmission:z,transmissionMap:I,thicknessMap:ne,gradientMap:re,opaque:T.transparent===!1&&T.blending===_i&&T.alphaToCoverage===!1,alphaMap:me,alphaTest:Q,alphaHash:K,combine:T.combine,mapUv:He&&x(T.map.channel),aoMapUv:et&&x(T.aoMap.channel),lightMapUv:Pe&&x(T.lightMap.channel),bumpMapUv:Se&&x(T.bumpMap.channel),normalMapUv:ge&&x(T.normalMap.channel),displacementMapUv:Ye&&x(T.displacementMap.channel),emissiveMapUv:de&&x(T.emissiveMap.channel),metalnessMapUv:Ne&&x(T.metalnessMap.channel),roughnessMapUv:ht&&x(T.roughnessMap.channel),anisotropyMapUv:H&&x(T.anisotropyMap.channel),clearcoatMapUv:ie&&x(T.clearcoatMap.channel),clearcoatNormalMapUv:ee&&x(T.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:he&&x(T.clearcoatRoughnessMap.channel),iridescenceMapUv:Me&&x(T.iridescenceMap.channel),iridescenceThicknessMapUv:J&&x(T.iridescenceThicknessMap.channel),sheenColorMapUv:le&&x(T.sheenColorMap.channel),sheenRoughnessMapUv:Re&&x(T.sheenRoughnessMap.channel),specularMapUv:Ee&&x(T.specularMap.channel),specularColorMapUv:oe&&x(T.specularColorMap.channel),specularIntensityMapUv:Oe&&x(T.specularIntensityMap.channel),transmissionMapUv:I&&x(T.transmissionMap.channel),thicknessMapUv:ne&&x(T.thicknessMap.channel),alphaMapUv:me&&x(T.alphaMap.channel),vertexTangents:!!q.attributes.tangent&&(ge||st),vertexColors:T.vertexColors,vertexAlphas:T.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!q.attributes.uv&&(He||me),fog:!!$,useFog:T.fog===!0,fogExp2:!!$&&$.isFogExp2,flatShading:T.flatShading===!0&&T.wireframe===!1,sizeAttenuation:T.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:pe,skinning:k.isSkinnedMesh===!0,morphTargets:q.morphAttributes.position!==void 0,morphNormals:q.morphAttributes.normal!==void 0,morphColors:q.morphAttributes.color!==void 0,morphTargetsCount:ve,morphTextureStride:Ie,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:T.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:Le,decodeVideoTexture:He&&T.map.isVideoTexture===!0&&qe.getTransfer(T.map.colorSpace)===Ze,decodeVideoTextureEmissive:de&&T.emissiveMap.isVideoTexture===!0&&qe.getTransfer(T.emissiveMap.colorSpace)===Ze,premultipliedAlpha:T.premultipliedAlpha,doubleSided:T.side===mn,flipSided:T.side===Ct,useDepthPacking:T.depthPacking>=0,depthPacking:T.depthPacking||0,index0AttributeName:T.index0AttributeName,extensionClipCullDistance:ye&&T.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ye&&T.extensions.multiDraw===!0||xe)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:T.customProgramCacheKey()};return tt.vertexUv1s=c.has(1),tt.vertexUv2s=c.has(2),tt.vertexUv3s=c.has(3),c.clear(),tt}function u(T){const S=[];if(T.shaderID?S.push(T.shaderID):(S.push(T.customVertexShaderID),S.push(T.customFragmentShaderID)),T.defines!==void 0)for(const C in T.defines)S.push(C),S.push(T.defines[C]);return T.isRawShaderMaterial===!1&&(A(S,T),b(S,T),S.push(i.outputColorSpace)),S.push(T.customProgramCacheKey),S.join()}function A(T,S){T.push(S.precision),T.push(S.outputColorSpace),T.push(S.envMapMode),T.push(S.envMapCubeUVHeight),T.push(S.mapUv),T.push(S.alphaMapUv),T.push(S.lightMapUv),T.push(S.aoMapUv),T.push(S.bumpMapUv),T.push(S.normalMapUv),T.push(S.displacementMapUv),T.push(S.emissiveMapUv),T.push(S.metalnessMapUv),T.push(S.roughnessMapUv),T.push(S.anisotropyMapUv),T.push(S.clearcoatMapUv),T.push(S.clearcoatNormalMapUv),T.push(S.clearcoatRoughnessMapUv),T.push(S.iridescenceMapUv),T.push(S.iridescenceThicknessMapUv),T.push(S.sheenColorMapUv),T.push(S.sheenRoughnessMapUv),T.push(S.specularMapUv),T.push(S.specularColorMapUv),T.push(S.specularIntensityMapUv),T.push(S.transmissionMapUv),T.push(S.thicknessMapUv),T.push(S.combine),T.push(S.fogExp2),T.push(S.sizeAttenuation),T.push(S.morphTargetsCount),T.push(S.morphAttributeCount),T.push(S.numDirLights),T.push(S.numPointLights),T.push(S.numSpotLights),T.push(S.numSpotLightMaps),T.push(S.numHemiLights),T.push(S.numRectAreaLights),T.push(S.numDirLightShadows),T.push(S.numPointLightShadows),T.push(S.numSpotLightShadows),T.push(S.numSpotLightShadowsWithMaps),T.push(S.numLightProbes),T.push(S.shadowMapType),T.push(S.toneMapping),T.push(S.numClippingPlanes),T.push(S.numClipIntersection),T.push(S.depthPacking)}function b(T,S){o.disableAll(),S.supportsVertexTextures&&o.enable(0),S.instancing&&o.enable(1),S.instancingColor&&o.enable(2),S.instancingMorph&&o.enable(3),S.matcap&&o.enable(4),S.envMap&&o.enable(5),S.normalMapObjectSpace&&o.enable(6),S.normalMapTangentSpace&&o.enable(7),S.clearcoat&&o.enable(8),S.iridescence&&o.enable(9),S.alphaTest&&o.enable(10),S.vertexColors&&o.enable(11),S.vertexAlphas&&o.enable(12),S.vertexUv1s&&o.enable(13),S.vertexUv2s&&o.enable(14),S.vertexUv3s&&o.enable(15),S.vertexTangents&&o.enable(16),S.anisotropy&&o.enable(17),S.alphaHash&&o.enable(18),S.batching&&o.enable(19),S.dispersion&&o.enable(20),S.batchingColor&&o.enable(21),S.gradientMap&&o.enable(22),T.push(o.mask),o.disableAll(),S.fog&&o.enable(0),S.useFog&&o.enable(1),S.flatShading&&o.enable(2),S.logarithmicDepthBuffer&&o.enable(3),S.reversedDepthBuffer&&o.enable(4),S.skinning&&o.enable(5),S.morphTargets&&o.enable(6),S.morphNormals&&o.enable(7),S.morphColors&&o.enable(8),S.premultipliedAlpha&&o.enable(9),S.shadowMapEnabled&&o.enable(10),S.doubleSided&&o.enable(11),S.flipSided&&o.enable(12),S.useDepthPacking&&o.enable(13),S.dithering&&o.enable(14),S.transmission&&o.enable(15),S.sheen&&o.enable(16),S.opaque&&o.enable(17),S.pointsUvs&&o.enable(18),S.decodeVideoTexture&&o.enable(19),S.decodeVideoTextureEmissive&&o.enable(20),S.alphaToCoverage&&o.enable(21),T.push(o.mask)}function E(T){const S=v[T.type];let C;if(S){const B=en[S];C=ku.clone(B.uniforms)}else C=T.uniforms;return C}function D(T,S){let C;for(let B=0,k=d.length;B<k;B++){const $=d[B];if($.cacheKey===S){C=$,++C.usedTimes;break}}return C===void 0&&(C=new gm(i,S,T,r),d.push(C)),C}function R(T){if(--T.usedTimes===0){const S=d.indexOf(T);d[S]=d[d.length-1],d.pop(),T.destroy()}}function P(T){l.remove(T)}function U(){l.dispose()}return{getParameters:g,getProgramCacheKey:u,getUniforms:E,acquireProgram:D,releaseProgram:R,releaseShaderCache:P,programs:d,dispose:U}}function ym(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function Sm(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function lc(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function uc(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(h,p,m,v,x,g){let u=i[e];return u===void 0?(u={id:h.id,object:h,geometry:p,material:m,groupOrder:v,renderOrder:h.renderOrder,z:x,group:g},i[e]=u):(u.id=h.id,u.object=h,u.geometry=p,u.material=m,u.groupOrder=v,u.renderOrder=h.renderOrder,u.z=x,u.group=g),e++,u}function o(h,p,m,v,x,g){const u=a(h,p,m,v,x,g);m.transmission>0?n.push(u):m.transparent===!0?s.push(u):t.push(u)}function l(h,p,m,v,x,g){const u=a(h,p,m,v,x,g);m.transmission>0?n.unshift(u):m.transparent===!0?s.unshift(u):t.unshift(u)}function c(h,p){t.length>1&&t.sort(h||Sm),n.length>1&&n.sort(p||lc),s.length>1&&s.sort(p||lc)}function d(){for(let h=e,p=i.length;h<p;h++){const m=i[h];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:d,sort:c}}function Em(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new uc,i.set(n,[a])):s>=r.length?(a=new uc,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function Tm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new N,color:new Fe};break;case"SpotLight":t={position:new N,direction:new N,color:new Fe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new N,color:new Fe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new N,skyColor:new Fe,groundColor:new Fe};break;case"RectAreaLight":t={color:new Fe,position:new N,halfWidth:new N,halfHeight:new N};break}return i[e.id]=t,t}}}function bm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let Am=0;function wm(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Rm(i){const e=new Tm,t=bm(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new N);const s=new N,r=new ot,a=new ot;function o(c){let d=0,h=0,p=0;for(let T=0;T<9;T++)n.probe[T].set(0,0,0);let m=0,v=0,x=0,g=0,u=0,A=0,b=0,E=0,D=0,R=0,P=0;c.sort(wm);for(let T=0,S=c.length;T<S;T++){const C=c[T],B=C.color,k=C.intensity,$=C.distance,q=C.shadow&&C.shadow.map?C.shadow.map.texture:null;if(C.isAmbientLight)d+=B.r*k,h+=B.g*k,p+=B.b*k;else if(C.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(C.sh.coefficients[X],k);P++}else if(C.isDirectionalLight){const X=e.get(C);if(X.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const Z=C.shadow,W=t.get(C);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,n.directionalShadow[m]=W,n.directionalShadowMap[m]=q,n.directionalShadowMatrix[m]=C.shadow.matrix,A++}n.directional[m]=X,m++}else if(C.isSpotLight){const X=e.get(C);X.position.setFromMatrixPosition(C.matrixWorld),X.color.copy(B).multiplyScalar(k),X.distance=$,X.coneCos=Math.cos(C.angle),X.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),X.decay=C.decay,n.spot[x]=X;const Z=C.shadow;if(C.map&&(n.spotLightMap[D]=C.map,D++,Z.updateMatrices(C),C.castShadow&&R++),n.spotLightMatrix[x]=Z.matrix,C.castShadow){const W=t.get(C);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,n.spotShadow[x]=W,n.spotShadowMap[x]=q,E++}x++}else if(C.isRectAreaLight){const X=e.get(C);X.color.copy(B).multiplyScalar(k),X.halfWidth.set(C.width*.5,0,0),X.halfHeight.set(0,C.height*.5,0),n.rectArea[g]=X,g++}else if(C.isPointLight){const X=e.get(C);if(X.color.copy(C.color).multiplyScalar(C.intensity),X.distance=C.distance,X.decay=C.decay,C.castShadow){const Z=C.shadow,W=t.get(C);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,W.shadowCameraNear=Z.camera.near,W.shadowCameraFar=Z.camera.far,n.pointShadow[v]=W,n.pointShadowMap[v]=q,n.pointShadowMatrix[v]=C.shadow.matrix,b++}n.point[v]=X,v++}else if(C.isHemisphereLight){const X=e.get(C);X.skyColor.copy(C.color).multiplyScalar(k),X.groundColor.copy(C.groundColor).multiplyScalar(k),n.hemi[u]=X,u++}}g>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ae.LTC_FLOAT_1,n.rectAreaLTC2=ae.LTC_FLOAT_2):(n.rectAreaLTC1=ae.LTC_HALF_1,n.rectAreaLTC2=ae.LTC_HALF_2)),n.ambient[0]=d,n.ambient[1]=h,n.ambient[2]=p;const U=n.hash;(U.directionalLength!==m||U.pointLength!==v||U.spotLength!==x||U.rectAreaLength!==g||U.hemiLength!==u||U.numDirectionalShadows!==A||U.numPointShadows!==b||U.numSpotShadows!==E||U.numSpotMaps!==D||U.numLightProbes!==P)&&(n.directional.length=m,n.spot.length=x,n.rectArea.length=g,n.point.length=v,n.hemi.length=u,n.directionalShadow.length=A,n.directionalShadowMap.length=A,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=E,n.spotShadowMap.length=E,n.directionalShadowMatrix.length=A,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=E+D-R,n.spotLightMap.length=D,n.numSpotLightShadowsWithMaps=R,n.numLightProbes=P,U.directionalLength=m,U.pointLength=v,U.spotLength=x,U.rectAreaLength=g,U.hemiLength=u,U.numDirectionalShadows=A,U.numPointShadows=b,U.numSpotShadows=E,U.numSpotMaps=D,U.numLightProbes=P,n.version=Am++)}function l(c,d){let h=0,p=0,m=0,v=0,x=0;const g=d.matrixWorldInverse;for(let u=0,A=c.length;u<A;u++){const b=c[u];if(b.isDirectionalLight){const E=n.directional[h];E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(g),h++}else if(b.isSpotLight){const E=n.spot[m];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(g),E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(g),m++}else if(b.isRectAreaLight){const E=n.rectArea[v];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(g),a.identity(),r.copy(b.matrixWorld),r.premultiply(g),a.extractRotation(r),E.halfWidth.set(b.width*.5,0,0),E.halfHeight.set(0,b.height*.5,0),E.halfWidth.applyMatrix4(a),E.halfHeight.applyMatrix4(a),v++}else if(b.isPointLight){const E=n.point[p];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(g),p++}else if(b.isHemisphereLight){const E=n.hemi[x];E.direction.setFromMatrixPosition(b.matrixWorld),E.direction.transformDirection(g),x++}}}return{setup:o,setupView:l,state:n}}function hc(i){const e=new Rm(i),t=[],n=[];function s(d){c.camera=d,t.length=0,n.length=0}function r(d){t.push(d)}function a(d){n.push(d)}function o(){e.setup(t)}function l(d){e.setupView(t,d)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function Cm(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new hc(i),e.set(s,[o])):r>=a.length?(o=new hc(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const Pm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Dm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Lm(i,e,t){let n=new ka;const s=new De,r=new De,a=new ut,o=new Ju({depthPacking:jl}),l=new Qu,c={},d=t.maxTextureSize,h={[Pn]:Ct,[Ct]:Pn,[mn]:mn},p=new Dn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new De},radius:{value:4}},vertexShader:Pm,fragmentShader:Dm}),m=p.clone();m.defines.HORIZONTAL_PASS=1;const v=new Ut;v.setAttribute("position",new rn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new it(v,p),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Sc;let u=this.type;this.render=function(R,P,U){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||R.length===0)return;const T=i.getRenderTarget(),S=i.getActiveCubeFace(),C=i.getActiveMipmapLevel(),B=i.state;B.setBlending(Rn),B.buffers.depth.getReversed()===!0?B.buffers.color.setClear(0,0,0,0):B.buffers.color.setClear(1,1,1,1),B.buffers.depth.setTest(!0),B.setScissorTest(!1);const k=u!==pn&&this.type===pn,$=u===pn&&this.type!==pn;for(let q=0,X=R.length;q<X;q++){const Z=R[q],W=Z.shadow;if(W===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);const se=W.getFrameExtents();if(s.multiply(se),r.copy(W.mapSize),(s.x>d||s.y>d)&&(s.x>d&&(r.x=Math.floor(d/se.x),s.x=r.x*se.x,W.mapSize.x=r.x),s.y>d&&(r.y=Math.floor(d/se.y),s.y=r.y*se.y,W.mapSize.y=r.y)),W.map===null||k===!0||$===!0){const ve=this.type!==pn?{minFilter:Yt,magFilter:Yt}:{};W.map!==null&&W.map.dispose(),W.map=new Yn(s.x,s.y,ve),W.map.texture.name=Z.name+".shadowMap",W.camera.updateProjectionMatrix()}i.setRenderTarget(W.map),i.clear();const ue=W.getViewportCount();for(let ve=0;ve<ue;ve++){const Ie=W.getViewport(ve);a.set(r.x*Ie.x,r.y*Ie.y,r.x*Ie.z,r.y*Ie.w),B.viewport(a),W.updateMatrices(Z,ve),n=W.getFrustum(),E(P,U,W.camera,Z,this.type)}W.isPointLightShadow!==!0&&this.type===pn&&A(W,U),W.needsUpdate=!1}u=this.type,g.needsUpdate=!1,i.setRenderTarget(T,S,C)};function A(R,P){const U=e.update(x);p.defines.VSM_SAMPLES!==R.blurSamples&&(p.defines.VSM_SAMPLES=R.blurSamples,m.defines.VSM_SAMPLES=R.blurSamples,p.needsUpdate=!0,m.needsUpdate=!0),R.mapPass===null&&(R.mapPass=new Yn(s.x,s.y)),p.uniforms.shadow_pass.value=R.map.texture,p.uniforms.resolution.value=R.mapSize,p.uniforms.radius.value=R.radius,i.setRenderTarget(R.mapPass),i.clear(),i.renderBufferDirect(P,null,U,p,x,null),m.uniforms.shadow_pass.value=R.mapPass.texture,m.uniforms.resolution.value=R.mapSize,m.uniforms.radius.value=R.radius,i.setRenderTarget(R.map),i.clear(),i.renderBufferDirect(P,null,U,m,x,null)}function b(R,P,U,T){let S=null;const C=U.isPointLight===!0?R.customDistanceMaterial:R.customDepthMaterial;if(C!==void 0)S=C;else if(S=U.isPointLight===!0?l:o,i.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){const B=S.uuid,k=P.uuid;let $=c[B];$===void 0&&($={},c[B]=$);let q=$[k];q===void 0&&(q=S.clone(),$[k]=q,P.addEventListener("dispose",D)),S=q}if(S.visible=P.visible,S.wireframe=P.wireframe,T===pn?S.side=P.shadowSide!==null?P.shadowSide:P.side:S.side=P.shadowSide!==null?P.shadowSide:h[P.side],S.alphaMap=P.alphaMap,S.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,S.map=P.map,S.clipShadows=P.clipShadows,S.clippingPlanes=P.clippingPlanes,S.clipIntersection=P.clipIntersection,S.displacementMap=P.displacementMap,S.displacementScale=P.displacementScale,S.displacementBias=P.displacementBias,S.wireframeLinewidth=P.wireframeLinewidth,S.linewidth=P.linewidth,U.isPointLight===!0&&S.isMeshDistanceMaterial===!0){const B=i.properties.get(S);B.light=U}return S}function E(R,P,U,T,S){if(R.visible===!1)return;if(R.layers.test(P.layers)&&(R.isMesh||R.isLine||R.isPoints)&&(R.castShadow||R.receiveShadow&&S===pn)&&(!R.frustumCulled||n.intersectsObject(R))){R.modelViewMatrix.multiplyMatrices(U.matrixWorldInverse,R.matrixWorld);const k=e.update(R),$=R.material;if(Array.isArray($)){const q=k.groups;for(let X=0,Z=q.length;X<Z;X++){const W=q[X],se=$[W.materialIndex];if(se&&se.visible){const ue=b(R,se,T,S);R.onBeforeShadow(i,R,P,U,k,ue,W),i.renderBufferDirect(U,null,k,ue,R,W),R.onAfterShadow(i,R,P,U,k,ue,W)}}}else if($.visible){const q=b(R,$,T,S);R.onBeforeShadow(i,R,P,U,k,q,null),i.renderBufferDirect(U,null,k,q,R,null),R.onAfterShadow(i,R,P,U,k,q,null)}}const B=R.children;for(let k=0,$=B.length;k<$;k++)E(B[k],P,U,T,S)}function D(R){R.target.removeEventListener("dispose",D);for(const U in c){const T=c[U],S=R.target.uuid;S in T&&(T[S].dispose(),delete T[S])}}}const Im={[Hr]:Gr,[Vr]:qr,[Wr]:$r,[Mi]:Xr,[Gr]:Hr,[qr]:Vr,[$r]:Wr,[Xr]:Mi};function Nm(i,e){function t(){let I=!1;const ne=new ut;let re=null;const me=new ut(0,0,0,0);return{setMask:function(Q){re!==Q&&!I&&(i.colorMask(Q,Q,Q,Q),re=Q)},setLocked:function(Q){I=Q},setClear:function(Q,K,ye,Le,tt){tt===!0&&(Q*=Le,K*=Le,ye*=Le),ne.set(Q,K,ye,Le),me.equals(ne)===!1&&(i.clearColor(Q,K,ye,Le),me.copy(ne))},reset:function(){I=!1,re=null,me.set(-1,0,0,0)}}}function n(){let I=!1,ne=!1,re=null,me=null,Q=null;return{setReversed:function(K){if(ne!==K){const ye=e.get("EXT_clip_control");K?ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.ZERO_TO_ONE_EXT):ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.NEGATIVE_ONE_TO_ONE_EXT),ne=K;const Le=Q;Q=null,this.setClear(Le)}},getReversed:function(){return ne},setTest:function(K){K?j(i.DEPTH_TEST):pe(i.DEPTH_TEST)},setMask:function(K){re!==K&&!I&&(i.depthMask(K),re=K)},setFunc:function(K){if(ne&&(K=Im[K]),me!==K){switch(K){case Hr:i.depthFunc(i.NEVER);break;case Gr:i.depthFunc(i.ALWAYS);break;case Vr:i.depthFunc(i.LESS);break;case Mi:i.depthFunc(i.LEQUAL);break;case Wr:i.depthFunc(i.EQUAL);break;case Xr:i.depthFunc(i.GEQUAL);break;case qr:i.depthFunc(i.GREATER);break;case $r:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}me=K}},setLocked:function(K){I=K},setClear:function(K){Q!==K&&(ne&&(K=1-K),i.clearDepth(K),Q=K)},reset:function(){I=!1,re=null,me=null,Q=null,ne=!1}}}function s(){let I=!1,ne=null,re=null,me=null,Q=null,K=null,ye=null,Le=null,tt=null;return{setTest:function(je){I||(je?j(i.STENCIL_TEST):pe(i.STENCIL_TEST))},setMask:function(je){ne!==je&&!I&&(i.stencilMask(je),ne=je)},setFunc:function(je,cn,Zt){(re!==je||me!==cn||Q!==Zt)&&(i.stencilFunc(je,cn,Zt),re=je,me=cn,Q=Zt)},setOp:function(je,cn,Zt){(K!==je||ye!==cn||Le!==Zt)&&(i.stencilOp(je,cn,Zt),K=je,ye=cn,Le=Zt)},setLocked:function(je){I=je},setClear:function(je){tt!==je&&(i.clearStencil(je),tt=je)},reset:function(){I=!1,ne=null,re=null,me=null,Q=null,K=null,ye=null,Le=null,tt=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let d={},h={},p=new WeakMap,m=[],v=null,x=!1,g=null,u=null,A=null,b=null,E=null,D=null,R=null,P=new Fe(0,0,0),U=0,T=!1,S=null,C=null,B=null,k=null,$=null;const q=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,Z=0;const W=i.getParameter(i.VERSION);W.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(W)[1]),X=Z>=1):W.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),X=Z>=2);let se=null,ue={};const ve=i.getParameter(i.SCISSOR_BOX),Ie=i.getParameter(i.VIEWPORT),We=new ut().fromArray(ve),$e=new ut().fromArray(Ie);function Ve(I,ne,re,me){const Q=new Uint8Array(4),K=i.createTexture();i.bindTexture(I,K),i.texParameteri(I,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(I,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let ye=0;ye<re;ye++)I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY?i.texImage3D(ne,0,i.RGBA,1,1,me,0,i.RGBA,i.UNSIGNED_BYTE,Q):i.texImage2D(ne+ye,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Q);return K}const Y={};Y[i.TEXTURE_2D]=Ve(i.TEXTURE_2D,i.TEXTURE_2D,1),Y[i.TEXTURE_CUBE_MAP]=Ve(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[i.TEXTURE_2D_ARRAY]=Ve(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Y[i.TEXTURE_3D]=Ve(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),j(i.DEPTH_TEST),a.setFunc(Mi),Se(!1),ge(ao),j(i.CULL_FACE),et(Rn);function j(I){d[I]!==!0&&(i.enable(I),d[I]=!0)}function pe(I){d[I]!==!1&&(i.disable(I),d[I]=!1)}function be(I,ne){return h[I]!==ne?(i.bindFramebuffer(I,ne),h[I]=ne,I===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=ne),I===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=ne),!0):!1}function xe(I,ne){let re=m,me=!1;if(I){re=p.get(ne),re===void 0&&(re=[],p.set(ne,re));const Q=I.textures;if(re.length!==Q.length||re[0]!==i.COLOR_ATTACHMENT0){for(let K=0,ye=Q.length;K<ye;K++)re[K]=i.COLOR_ATTACHMENT0+K;re.length=Q.length,me=!0}}else re[0]!==i.BACK&&(re[0]=i.BACK,me=!0);me&&i.drawBuffers(re)}function He(I){return v!==I?(i.useProgram(I),v=I,!0):!1}const vt={[Gn]:i.FUNC_ADD,[Sl]:i.FUNC_SUBTRACT,[El]:i.FUNC_REVERSE_SUBTRACT};vt[Tl]=i.MIN,vt[bl]=i.MAX;const w={[Al]:i.ZERO,[wl]:i.ONE,[Rl]:i.SRC_COLOR,[zr]:i.SRC_ALPHA,[Nl]:i.SRC_ALPHA_SATURATE,[Ll]:i.DST_COLOR,[Pl]:i.DST_ALPHA,[Cl]:i.ONE_MINUS_SRC_COLOR,[kr]:i.ONE_MINUS_SRC_ALPHA,[Il]:i.ONE_MINUS_DST_COLOR,[Dl]:i.ONE_MINUS_DST_ALPHA,[Ul]:i.CONSTANT_COLOR,[Fl]:i.ONE_MINUS_CONSTANT_COLOR,[Ol]:i.CONSTANT_ALPHA,[Bl]:i.ONE_MINUS_CONSTANT_ALPHA};function et(I,ne,re,me,Q,K,ye,Le,tt,je){if(I===Rn){x===!0&&(pe(i.BLEND),x=!1);return}if(x===!1&&(j(i.BLEND),x=!0),I!==yl){if(I!==g||je!==T){if((u!==Gn||E!==Gn)&&(i.blendEquation(i.FUNC_ADD),u=Gn,E=Gn),je)switch(I){case _i:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oo:i.blendFunc(i.ONE,i.ONE);break;case co:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case lo:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case _i:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oo:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case co:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case lo:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}A=null,b=null,D=null,R=null,P.set(0,0,0),U=0,g=I,T=je}return}Q=Q||ne,K=K||re,ye=ye||me,(ne!==u||Q!==E)&&(i.blendEquationSeparate(vt[ne],vt[Q]),u=ne,E=Q),(re!==A||me!==b||K!==D||ye!==R)&&(i.blendFuncSeparate(w[re],w[me],w[K],w[ye]),A=re,b=me,D=K,R=ye),(Le.equals(P)===!1||tt!==U)&&(i.blendColor(Le.r,Le.g,Le.b,tt),P.copy(Le),U=tt),g=I,T=!1}function Pe(I,ne){I.side===mn?pe(i.CULL_FACE):j(i.CULL_FACE);let re=I.side===Ct;ne&&(re=!re),Se(re),I.blending===_i&&I.transparent===!1?et(Rn):et(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),a.setFunc(I.depthFunc),a.setTest(I.depthTest),a.setMask(I.depthWrite),r.setMask(I.colorWrite);const me=I.stencilWrite;o.setTest(me),me&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),de(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?j(i.SAMPLE_ALPHA_TO_COVERAGE):pe(i.SAMPLE_ALPHA_TO_COVERAGE)}function Se(I){S!==I&&(I?i.frontFace(i.CW):i.frontFace(i.CCW),S=I)}function ge(I){I!==xl?(j(i.CULL_FACE),I!==C&&(I===ao?i.cullFace(i.BACK):I===Ml?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):pe(i.CULL_FACE),C=I}function Ye(I){I!==B&&(X&&i.lineWidth(I),B=I)}function de(I,ne,re){I?(j(i.POLYGON_OFFSET_FILL),(k!==ne||$!==re)&&(i.polygonOffset(ne,re),k=ne,$=re)):pe(i.POLYGON_OFFSET_FILL)}function Ne(I){I?j(i.SCISSOR_TEST):pe(i.SCISSOR_TEST)}function ht(I){I===void 0&&(I=i.TEXTURE0+q-1),se!==I&&(i.activeTexture(I),se=I)}function st(I,ne,re){re===void 0&&(se===null?re=i.TEXTURE0+q-1:re=se);let me=ue[re];me===void 0&&(me={type:void 0,texture:void 0},ue[re]=me),(me.type!==I||me.texture!==ne)&&(se!==re&&(i.activeTexture(re),se=re),i.bindTexture(I,ne||Y[I]),me.type=I,me.texture=ne)}function _(){const I=ue[se];I!==void 0&&I.type!==void 0&&(i.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function f(){try{i.compressedTexImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function y(){try{i.compressedTexImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function L(){try{i.texSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function z(){try{i.texSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function H(){try{i.compressedTexSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ie(){try{i.compressedTexSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ee(){try{i.texStorage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function he(){try{i.texStorage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Me(){try{i.texImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function J(){try{i.texImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function le(I){We.equals(I)===!1&&(i.scissor(I.x,I.y,I.z,I.w),We.copy(I))}function Re(I){$e.equals(I)===!1&&(i.viewport(I.x,I.y,I.z,I.w),$e.copy(I))}function Ee(I,ne){let re=c.get(ne);re===void 0&&(re=new WeakMap,c.set(ne,re));let me=re.get(I);me===void 0&&(me=i.getUniformBlockIndex(ne,I.name),re.set(I,me))}function oe(I,ne){const me=c.get(ne).get(I);l.get(ne)!==me&&(i.uniformBlockBinding(ne,me,I.__bindingPointIndex),l.set(ne,me))}function Oe(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),d={},se=null,ue={},h={},p=new WeakMap,m=[],v=null,x=!1,g=null,u=null,A=null,b=null,E=null,D=null,R=null,P=new Fe(0,0,0),U=0,T=!1,S=null,C=null,B=null,k=null,$=null,We.set(0,0,i.canvas.width,i.canvas.height),$e.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:j,disable:pe,bindFramebuffer:be,drawBuffers:xe,useProgram:He,setBlending:et,setMaterial:Pe,setFlipSided:Se,setCullFace:ge,setLineWidth:Ye,setPolygonOffset:de,setScissorTest:Ne,activeTexture:ht,bindTexture:st,unbindTexture:_,compressedTexImage2D:f,compressedTexImage3D:y,texImage2D:Me,texImage3D:J,updateUBOMapping:Ee,uniformBlockBinding:oe,texStorage2D:ee,texStorage3D:he,texSubImage2D:L,texSubImage3D:z,compressedTexSubImage2D:H,compressedTexSubImage3D:ie,scissor:le,viewport:Re,reset:Oe}}function Um(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new De,d=new WeakMap;let h;const p=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(_,f){return m?new OffscreenCanvas(_,f):Gs("canvas")}function x(_,f,y){let L=1;const z=st(_);if((z.width>y||z.height>y)&&(L=y/Math.max(z.width,z.height)),L<1)if(typeof HTMLImageElement<"u"&&_ instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&_ instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&_ instanceof ImageBitmap||typeof VideoFrame<"u"&&_ instanceof VideoFrame){const H=Math.floor(L*z.width),ie=Math.floor(L*z.height);h===void 0&&(h=v(H,ie));const ee=f?v(H,ie):h;return ee.width=H,ee.height=ie,ee.getContext("2d").drawImage(_,0,0,H,ie),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+z.width+"x"+z.height+") to ("+H+"x"+ie+")."),ee}else return"data"in _&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+z.width+"x"+z.height+")."),_;return _}function g(_){return _.generateMipmaps}function u(_){i.generateMipmap(_)}function A(_){return _.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:_.isWebGL3DRenderTarget?i.TEXTURE_3D:_.isWebGLArrayRenderTarget||_.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function b(_,f,y,L,z=!1){if(_!==null){if(i[_]!==void 0)return i[_];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+_+"'")}let H=f;if(f===i.RED&&(y===i.FLOAT&&(H=i.R32F),y===i.HALF_FLOAT&&(H=i.R16F),y===i.UNSIGNED_BYTE&&(H=i.R8)),f===i.RED_INTEGER&&(y===i.UNSIGNED_BYTE&&(H=i.R8UI),y===i.UNSIGNED_SHORT&&(H=i.R16UI),y===i.UNSIGNED_INT&&(H=i.R32UI),y===i.BYTE&&(H=i.R8I),y===i.SHORT&&(H=i.R16I),y===i.INT&&(H=i.R32I)),f===i.RG&&(y===i.FLOAT&&(H=i.RG32F),y===i.HALF_FLOAT&&(H=i.RG16F),y===i.UNSIGNED_BYTE&&(H=i.RG8)),f===i.RG_INTEGER&&(y===i.UNSIGNED_BYTE&&(H=i.RG8UI),y===i.UNSIGNED_SHORT&&(H=i.RG16UI),y===i.UNSIGNED_INT&&(H=i.RG32UI),y===i.BYTE&&(H=i.RG8I),y===i.SHORT&&(H=i.RG16I),y===i.INT&&(H=i.RG32I)),f===i.RGB_INTEGER&&(y===i.UNSIGNED_BYTE&&(H=i.RGB8UI),y===i.UNSIGNED_SHORT&&(H=i.RGB16UI),y===i.UNSIGNED_INT&&(H=i.RGB32UI),y===i.BYTE&&(H=i.RGB8I),y===i.SHORT&&(H=i.RGB16I),y===i.INT&&(H=i.RGB32I)),f===i.RGBA_INTEGER&&(y===i.UNSIGNED_BYTE&&(H=i.RGBA8UI),y===i.UNSIGNED_SHORT&&(H=i.RGBA16UI),y===i.UNSIGNED_INT&&(H=i.RGBA32UI),y===i.BYTE&&(H=i.RGBA8I),y===i.SHORT&&(H=i.RGBA16I),y===i.INT&&(H=i.RGBA32I)),f===i.RGB&&(y===i.UNSIGNED_INT_5_9_9_9_REV&&(H=i.RGB9_E5),y===i.UNSIGNED_INT_10F_11F_11F_REV&&(H=i.R11F_G11F_B10F)),f===i.RGBA){const ie=z?zs:qe.getTransfer(L);y===i.FLOAT&&(H=i.RGBA32F),y===i.HALF_FLOAT&&(H=i.RGBA16F),y===i.UNSIGNED_BYTE&&(H=ie===Ze?i.SRGB8_ALPHA8:i.RGBA8),y===i.UNSIGNED_SHORT_4_4_4_4&&(H=i.RGBA4),y===i.UNSIGNED_SHORT_5_5_5_1&&(H=i.RGB5_A1)}return(H===i.R16F||H===i.R32F||H===i.RG16F||H===i.RG32F||H===i.RGBA16F||H===i.RGBA32F)&&e.get("EXT_color_buffer_float"),H}function E(_,f){let y;return _?f===null||f===qn||f===$i?y=i.DEPTH24_STENCIL8:f===gn?y=i.DEPTH32F_STENCIL8:f===qi&&(y=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):f===null||f===qn||f===$i?y=i.DEPTH_COMPONENT24:f===gn?y=i.DEPTH_COMPONENT32F:f===qi&&(y=i.DEPTH_COMPONENT16),y}function D(_,f){return g(_)===!0||_.isFramebufferTexture&&_.minFilter!==Yt&&_.minFilter!==tn?Math.log2(Math.max(f.width,f.height))+1:_.mipmaps!==void 0&&_.mipmaps.length>0?_.mipmaps.length:_.isCompressedTexture&&Array.isArray(_.image)?f.mipmaps.length:1}function R(_){const f=_.target;f.removeEventListener("dispose",R),U(f),f.isVideoTexture&&d.delete(f)}function P(_){const f=_.target;f.removeEventListener("dispose",P),S(f)}function U(_){const f=n.get(_);if(f.__webglInit===void 0)return;const y=_.source,L=p.get(y);if(L){const z=L[f.__cacheKey];z.usedTimes--,z.usedTimes===0&&T(_),Object.keys(L).length===0&&p.delete(y)}n.remove(_)}function T(_){const f=n.get(_);i.deleteTexture(f.__webglTexture);const y=_.source,L=p.get(y);delete L[f.__cacheKey],a.memory.textures--}function S(_){const f=n.get(_);if(_.depthTexture&&(_.depthTexture.dispose(),n.remove(_.depthTexture)),_.isWebGLCubeRenderTarget)for(let L=0;L<6;L++){if(Array.isArray(f.__webglFramebuffer[L]))for(let z=0;z<f.__webglFramebuffer[L].length;z++)i.deleteFramebuffer(f.__webglFramebuffer[L][z]);else i.deleteFramebuffer(f.__webglFramebuffer[L]);f.__webglDepthbuffer&&i.deleteRenderbuffer(f.__webglDepthbuffer[L])}else{if(Array.isArray(f.__webglFramebuffer))for(let L=0;L<f.__webglFramebuffer.length;L++)i.deleteFramebuffer(f.__webglFramebuffer[L]);else i.deleteFramebuffer(f.__webglFramebuffer);if(f.__webglDepthbuffer&&i.deleteRenderbuffer(f.__webglDepthbuffer),f.__webglMultisampledFramebuffer&&i.deleteFramebuffer(f.__webglMultisampledFramebuffer),f.__webglColorRenderbuffer)for(let L=0;L<f.__webglColorRenderbuffer.length;L++)f.__webglColorRenderbuffer[L]&&i.deleteRenderbuffer(f.__webglColorRenderbuffer[L]);f.__webglDepthRenderbuffer&&i.deleteRenderbuffer(f.__webglDepthRenderbuffer)}const y=_.textures;for(let L=0,z=y.length;L<z;L++){const H=n.get(y[L]);H.__webglTexture&&(i.deleteTexture(H.__webglTexture),a.memory.textures--),n.remove(y[L])}n.remove(_)}let C=0;function B(){C=0}function k(){const _=C;return _>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+_+" texture units while this GPU supports only "+s.maxTextures),C+=1,_}function $(_){const f=[];return f.push(_.wrapS),f.push(_.wrapT),f.push(_.wrapR||0),f.push(_.magFilter),f.push(_.minFilter),f.push(_.anisotropy),f.push(_.internalFormat),f.push(_.format),f.push(_.type),f.push(_.generateMipmaps),f.push(_.premultiplyAlpha),f.push(_.flipY),f.push(_.unpackAlignment),f.push(_.colorSpace),f.join()}function q(_,f){const y=n.get(_);if(_.isVideoTexture&&Ne(_),_.isRenderTargetTexture===!1&&_.isExternalTexture!==!0&&_.version>0&&y.__version!==_.version){const L=_.image;if(L===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(L.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(y,_,f);return}}else _.isExternalTexture&&(y.__webglTexture=_.sourceTexture?_.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,y.__webglTexture,i.TEXTURE0+f)}function X(_,f){const y=n.get(_);if(_.isRenderTargetTexture===!1&&_.version>0&&y.__version!==_.version){Y(y,_,f);return}t.bindTexture(i.TEXTURE_2D_ARRAY,y.__webglTexture,i.TEXTURE0+f)}function Z(_,f){const y=n.get(_);if(_.isRenderTargetTexture===!1&&_.version>0&&y.__version!==_.version){Y(y,_,f);return}t.bindTexture(i.TEXTURE_3D,y.__webglTexture,i.TEXTURE0+f)}function W(_,f){const y=n.get(_);if(_.version>0&&y.__version!==_.version){j(y,_,f);return}t.bindTexture(i.TEXTURE_CUBE_MAP,y.__webglTexture,i.TEXTURE0+f)}const se={[Kr]:i.REPEAT,[Wn]:i.CLAMP_TO_EDGE,[Zr]:i.MIRRORED_REPEAT},ue={[Yt]:i.NEAREST,[$l]:i.NEAREST_MIPMAP_NEAREST,[rs]:i.NEAREST_MIPMAP_LINEAR,[tn]:i.LINEAR,[ir]:i.LINEAR_MIPMAP_NEAREST,[Xn]:i.LINEAR_MIPMAP_LINEAR},ve={[Zl]:i.NEVER,[iu]:i.ALWAYS,[Jl]:i.LESS,[Fc]:i.LEQUAL,[Ql]:i.EQUAL,[nu]:i.GEQUAL,[eu]:i.GREATER,[tu]:i.NOTEQUAL};function Ie(_,f){if(f.type===gn&&e.has("OES_texture_float_linear")===!1&&(f.magFilter===tn||f.magFilter===ir||f.magFilter===rs||f.magFilter===Xn||f.minFilter===tn||f.minFilter===ir||f.minFilter===rs||f.minFilter===Xn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(_,i.TEXTURE_WRAP_S,se[f.wrapS]),i.texParameteri(_,i.TEXTURE_WRAP_T,se[f.wrapT]),(_===i.TEXTURE_3D||_===i.TEXTURE_2D_ARRAY)&&i.texParameteri(_,i.TEXTURE_WRAP_R,se[f.wrapR]),i.texParameteri(_,i.TEXTURE_MAG_FILTER,ue[f.magFilter]),i.texParameteri(_,i.TEXTURE_MIN_FILTER,ue[f.minFilter]),f.compareFunction&&(i.texParameteri(_,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(_,i.TEXTURE_COMPARE_FUNC,ve[f.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(f.magFilter===Yt||f.minFilter!==rs&&f.minFilter!==Xn||f.type===gn&&e.has("OES_texture_float_linear")===!1)return;if(f.anisotropy>1||n.get(f).__currentAnisotropy){const y=e.get("EXT_texture_filter_anisotropic");i.texParameterf(_,y.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(f.anisotropy,s.getMaxAnisotropy())),n.get(f).__currentAnisotropy=f.anisotropy}}}function We(_,f){let y=!1;_.__webglInit===void 0&&(_.__webglInit=!0,f.addEventListener("dispose",R));const L=f.source;let z=p.get(L);z===void 0&&(z={},p.set(L,z));const H=$(f);if(H!==_.__cacheKey){z[H]===void 0&&(z[H]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,y=!0),z[H].usedTimes++;const ie=z[_.__cacheKey];ie!==void 0&&(z[_.__cacheKey].usedTimes--,ie.usedTimes===0&&T(f)),_.__cacheKey=H,_.__webglTexture=z[H].texture}return y}function $e(_,f,y){return Math.floor(Math.floor(_/y)/f)}function Ve(_,f,y,L){const H=_.updateRanges;if(H.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,f.width,f.height,y,L,f.data);else{H.sort((J,le)=>J.start-le.start);let ie=0;for(let J=1;J<H.length;J++){const le=H[ie],Re=H[J],Ee=le.start+le.count,oe=$e(Re.start,f.width,4),Oe=$e(le.start,f.width,4);Re.start<=Ee+1&&oe===Oe&&$e(Re.start+Re.count-1,f.width,4)===oe?le.count=Math.max(le.count,Re.start+Re.count-le.start):(++ie,H[ie]=Re)}H.length=ie+1;const ee=i.getParameter(i.UNPACK_ROW_LENGTH),he=i.getParameter(i.UNPACK_SKIP_PIXELS),Me=i.getParameter(i.UNPACK_SKIP_ROWS);i.pixelStorei(i.UNPACK_ROW_LENGTH,f.width);for(let J=0,le=H.length;J<le;J++){const Re=H[J],Ee=Math.floor(Re.start/4),oe=Math.ceil(Re.count/4),Oe=Ee%f.width,I=Math.floor(Ee/f.width),ne=oe,re=1;i.pixelStorei(i.UNPACK_SKIP_PIXELS,Oe),i.pixelStorei(i.UNPACK_SKIP_ROWS,I),t.texSubImage2D(i.TEXTURE_2D,0,Oe,I,ne,re,y,L,f.data)}_.clearUpdateRanges(),i.pixelStorei(i.UNPACK_ROW_LENGTH,ee),i.pixelStorei(i.UNPACK_SKIP_PIXELS,he),i.pixelStorei(i.UNPACK_SKIP_ROWS,Me)}}function Y(_,f,y){let L=i.TEXTURE_2D;(f.isDataArrayTexture||f.isCompressedArrayTexture)&&(L=i.TEXTURE_2D_ARRAY),f.isData3DTexture&&(L=i.TEXTURE_3D);const z=We(_,f),H=f.source;t.bindTexture(L,_.__webglTexture,i.TEXTURE0+y);const ie=n.get(H);if(H.version!==ie.__version||z===!0){t.activeTexture(i.TEXTURE0+y);const ee=qe.getPrimaries(qe.workingColorSpace),he=f.colorSpace===wn?null:qe.getPrimaries(f.colorSpace),Me=f.colorSpace===wn||ee===he?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,f.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,f.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,f.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Me);let J=x(f.image,!1,s.maxTextureSize);J=ht(f,J);const le=r.convert(f.format,f.colorSpace),Re=r.convert(f.type);let Ee=b(f.internalFormat,le,Re,f.colorSpace,f.isVideoTexture);Ie(L,f);let oe;const Oe=f.mipmaps,I=f.isVideoTexture!==!0,ne=ie.__version===void 0||z===!0,re=H.dataReady,me=D(f,J);if(f.isDepthTexture)Ee=E(f.format===ji,f.type),ne&&(I?t.texStorage2D(i.TEXTURE_2D,1,Ee,J.width,J.height):t.texImage2D(i.TEXTURE_2D,0,Ee,J.width,J.height,0,le,Re,null));else if(f.isDataTexture)if(Oe.length>0){I&&ne&&t.texStorage2D(i.TEXTURE_2D,me,Ee,Oe[0].width,Oe[0].height);for(let Q=0,K=Oe.length;Q<K;Q++)oe=Oe[Q],I?re&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,oe.width,oe.height,le,Re,oe.data):t.texImage2D(i.TEXTURE_2D,Q,Ee,oe.width,oe.height,0,le,Re,oe.data);f.generateMipmaps=!1}else I?(ne&&t.texStorage2D(i.TEXTURE_2D,me,Ee,J.width,J.height),re&&Ve(f,J,le,Re)):t.texImage2D(i.TEXTURE_2D,0,Ee,J.width,J.height,0,le,Re,J.data);else if(f.isCompressedTexture)if(f.isCompressedArrayTexture){I&&ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,me,Ee,Oe[0].width,Oe[0].height,J.depth);for(let Q=0,K=Oe.length;Q<K;Q++)if(oe=Oe[Q],f.format!==Xt)if(le!==null)if(I){if(re)if(f.layerUpdates.size>0){const ye=Ho(oe.width,oe.height,f.format,f.type);for(const Le of f.layerUpdates){const tt=oe.data.subarray(Le*ye/oe.data.BYTES_PER_ELEMENT,(Le+1)*ye/oe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,Le,oe.width,oe.height,1,le,tt)}f.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,oe.width,oe.height,J.depth,le,oe.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Q,Ee,oe.width,oe.height,J.depth,0,oe.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else I?re&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,oe.width,oe.height,J.depth,le,Re,oe.data):t.texImage3D(i.TEXTURE_2D_ARRAY,Q,Ee,oe.width,oe.height,J.depth,0,le,Re,oe.data)}else{I&&ne&&t.texStorage2D(i.TEXTURE_2D,me,Ee,Oe[0].width,Oe[0].height);for(let Q=0,K=Oe.length;Q<K;Q++)oe=Oe[Q],f.format!==Xt?le!==null?I?re&&t.compressedTexSubImage2D(i.TEXTURE_2D,Q,0,0,oe.width,oe.height,le,oe.data):t.compressedTexImage2D(i.TEXTURE_2D,Q,Ee,oe.width,oe.height,0,oe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):I?re&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,oe.width,oe.height,le,Re,oe.data):t.texImage2D(i.TEXTURE_2D,Q,Ee,oe.width,oe.height,0,le,Re,oe.data)}else if(f.isDataArrayTexture)if(I){if(ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,me,Ee,J.width,J.height,J.depth),re)if(f.layerUpdates.size>0){const Q=Ho(J.width,J.height,f.format,f.type);for(const K of f.layerUpdates){const ye=J.data.subarray(K*Q/J.data.BYTES_PER_ELEMENT,(K+1)*Q/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,K,J.width,J.height,1,le,Re,ye)}f.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,le,Re,J.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Ee,J.width,J.height,J.depth,0,le,Re,J.data);else if(f.isData3DTexture)I?(ne&&t.texStorage3D(i.TEXTURE_3D,me,Ee,J.width,J.height,J.depth),re&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,le,Re,J.data)):t.texImage3D(i.TEXTURE_3D,0,Ee,J.width,J.height,J.depth,0,le,Re,J.data);else if(f.isFramebufferTexture){if(ne)if(I)t.texStorage2D(i.TEXTURE_2D,me,Ee,J.width,J.height);else{let Q=J.width,K=J.height;for(let ye=0;ye<me;ye++)t.texImage2D(i.TEXTURE_2D,ye,Ee,Q,K,0,le,Re,null),Q>>=1,K>>=1}}else if(Oe.length>0){if(I&&ne){const Q=st(Oe[0]);t.texStorage2D(i.TEXTURE_2D,me,Ee,Q.width,Q.height)}for(let Q=0,K=Oe.length;Q<K;Q++)oe=Oe[Q],I?re&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,le,Re,oe):t.texImage2D(i.TEXTURE_2D,Q,Ee,le,Re,oe);f.generateMipmaps=!1}else if(I){if(ne){const Q=st(J);t.texStorage2D(i.TEXTURE_2D,me,Ee,Q.width,Q.height)}re&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,le,Re,J)}else t.texImage2D(i.TEXTURE_2D,0,Ee,le,Re,J);g(f)&&u(L),ie.__version=H.version,f.onUpdate&&f.onUpdate(f)}_.__version=f.version}function j(_,f,y){if(f.image.length!==6)return;const L=We(_,f),z=f.source;t.bindTexture(i.TEXTURE_CUBE_MAP,_.__webglTexture,i.TEXTURE0+y);const H=n.get(z);if(z.version!==H.__version||L===!0){t.activeTexture(i.TEXTURE0+y);const ie=qe.getPrimaries(qe.workingColorSpace),ee=f.colorSpace===wn?null:qe.getPrimaries(f.colorSpace),he=f.colorSpace===wn||ie===ee?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,f.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,f.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,f.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,he);const Me=f.isCompressedTexture||f.image[0].isCompressedTexture,J=f.image[0]&&f.image[0].isDataTexture,le=[];for(let K=0;K<6;K++)!Me&&!J?le[K]=x(f.image[K],!0,s.maxCubemapSize):le[K]=J?f.image[K].image:f.image[K],le[K]=ht(f,le[K]);const Re=le[0],Ee=r.convert(f.format,f.colorSpace),oe=r.convert(f.type),Oe=b(f.internalFormat,Ee,oe,f.colorSpace),I=f.isVideoTexture!==!0,ne=H.__version===void 0||L===!0,re=z.dataReady;let me=D(f,Re);Ie(i.TEXTURE_CUBE_MAP,f);let Q;if(Me){I&&ne&&t.texStorage2D(i.TEXTURE_CUBE_MAP,me,Oe,Re.width,Re.height);for(let K=0;K<6;K++){Q=le[K].mipmaps;for(let ye=0;ye<Q.length;ye++){const Le=Q[ye];f.format!==Xt?Ee!==null?I?re&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,0,0,Le.width,Le.height,Ee,Le.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,Oe,Le.width,Le.height,0,Le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):I?re&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,0,0,Le.width,Le.height,Ee,oe,Le.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,Oe,Le.width,Le.height,0,Ee,oe,Le.data)}}}else{if(Q=f.mipmaps,I&&ne){Q.length>0&&me++;const K=st(le[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,me,Oe,K.width,K.height)}for(let K=0;K<6;K++)if(J){I?re&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,le[K].width,le[K].height,Ee,oe,le[K].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Oe,le[K].width,le[K].height,0,Ee,oe,le[K].data);for(let ye=0;ye<Q.length;ye++){const tt=Q[ye].image[K].image;I?re&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,0,0,tt.width,tt.height,Ee,oe,tt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,Oe,tt.width,tt.height,0,Ee,oe,tt.data)}}else{I?re&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,Ee,oe,le[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Oe,Ee,oe,le[K]);for(let ye=0;ye<Q.length;ye++){const Le=Q[ye];I?re&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,0,0,Ee,oe,Le.image[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,Oe,Ee,oe,Le.image[K])}}}g(f)&&u(i.TEXTURE_CUBE_MAP),H.__version=z.version,f.onUpdate&&f.onUpdate(f)}_.__version=f.version}function pe(_,f,y,L,z,H){const ie=r.convert(y.format,y.colorSpace),ee=r.convert(y.type),he=b(y.internalFormat,ie,ee,y.colorSpace),Me=n.get(f),J=n.get(y);if(J.__renderTarget=f,!Me.__hasExternalTextures){const le=Math.max(1,f.width>>H),Re=Math.max(1,f.height>>H);z===i.TEXTURE_3D||z===i.TEXTURE_2D_ARRAY?t.texImage3D(z,H,he,le,Re,f.depth,0,ie,ee,null):t.texImage2D(z,H,he,le,Re,0,ie,ee,null)}t.bindFramebuffer(i.FRAMEBUFFER,_),de(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,L,z,J.__webglTexture,0,Ye(f)):(z===i.TEXTURE_2D||z>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&z<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,L,z,J.__webglTexture,H),t.bindFramebuffer(i.FRAMEBUFFER,null)}function be(_,f,y){if(i.bindRenderbuffer(i.RENDERBUFFER,_),f.depthBuffer){const L=f.depthTexture,z=L&&L.isDepthTexture?L.type:null,H=E(f.stencilBuffer,z),ie=f.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ee=Ye(f);de(f)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ee,H,f.width,f.height):y?i.renderbufferStorageMultisample(i.RENDERBUFFER,ee,H,f.width,f.height):i.renderbufferStorage(i.RENDERBUFFER,H,f.width,f.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ie,i.RENDERBUFFER,_)}else{const L=f.textures;for(let z=0;z<L.length;z++){const H=L[z],ie=r.convert(H.format,H.colorSpace),ee=r.convert(H.type),he=b(H.internalFormat,ie,ee,H.colorSpace),Me=Ye(f);y&&de(f)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Me,he,f.width,f.height):de(f)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Me,he,f.width,f.height):i.renderbufferStorage(i.RENDERBUFFER,he,f.width,f.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function xe(_,f){if(f&&f.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,_),!(f.depthTexture&&f.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const L=n.get(f.depthTexture);L.__renderTarget=f,(!L.__webglTexture||f.depthTexture.image.width!==f.width||f.depthTexture.image.height!==f.height)&&(f.depthTexture.image.width=f.width,f.depthTexture.image.height=f.height,f.depthTexture.needsUpdate=!0),q(f.depthTexture,0);const z=L.__webglTexture,H=Ye(f);if(f.depthTexture.format===Yi)de(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,z,0,H):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,z,0);else if(f.depthTexture.format===ji)de(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,z,0,H):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,z,0);else throw new Error("Unknown depthTexture format")}function He(_){const f=n.get(_),y=_.isWebGLCubeRenderTarget===!0;if(f.__boundDepthTexture!==_.depthTexture){const L=_.depthTexture;if(f.__depthDisposeCallback&&f.__depthDisposeCallback(),L){const z=()=>{delete f.__boundDepthTexture,delete f.__depthDisposeCallback,L.removeEventListener("dispose",z)};L.addEventListener("dispose",z),f.__depthDisposeCallback=z}f.__boundDepthTexture=L}if(_.depthTexture&&!f.__autoAllocateDepthBuffer){if(y)throw new Error("target.depthTexture not supported in Cube render targets");const L=_.texture.mipmaps;L&&L.length>0?xe(f.__webglFramebuffer[0],_):xe(f.__webglFramebuffer,_)}else if(y){f.__webglDepthbuffer=[];for(let L=0;L<6;L++)if(t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer[L]),f.__webglDepthbuffer[L]===void 0)f.__webglDepthbuffer[L]=i.createRenderbuffer(),be(f.__webglDepthbuffer[L],_,!1);else{const z=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,H=f.__webglDepthbuffer[L];i.bindRenderbuffer(i.RENDERBUFFER,H),i.framebufferRenderbuffer(i.FRAMEBUFFER,z,i.RENDERBUFFER,H)}}else{const L=_.texture.mipmaps;if(L&&L.length>0?t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer),f.__webglDepthbuffer===void 0)f.__webglDepthbuffer=i.createRenderbuffer(),be(f.__webglDepthbuffer,_,!1);else{const z=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,H=f.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,H),i.framebufferRenderbuffer(i.FRAMEBUFFER,z,i.RENDERBUFFER,H)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function vt(_,f,y){const L=n.get(_);f!==void 0&&pe(L.__webglFramebuffer,_,_.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),y!==void 0&&He(_)}function w(_){const f=_.texture,y=n.get(_),L=n.get(f);_.addEventListener("dispose",P);const z=_.textures,H=_.isWebGLCubeRenderTarget===!0,ie=z.length>1;if(ie||(L.__webglTexture===void 0&&(L.__webglTexture=i.createTexture()),L.__version=f.version,a.memory.textures++),H){y.__webglFramebuffer=[];for(let ee=0;ee<6;ee++)if(f.mipmaps&&f.mipmaps.length>0){y.__webglFramebuffer[ee]=[];for(let he=0;he<f.mipmaps.length;he++)y.__webglFramebuffer[ee][he]=i.createFramebuffer()}else y.__webglFramebuffer[ee]=i.createFramebuffer()}else{if(f.mipmaps&&f.mipmaps.length>0){y.__webglFramebuffer=[];for(let ee=0;ee<f.mipmaps.length;ee++)y.__webglFramebuffer[ee]=i.createFramebuffer()}else y.__webglFramebuffer=i.createFramebuffer();if(ie)for(let ee=0,he=z.length;ee<he;ee++){const Me=n.get(z[ee]);Me.__webglTexture===void 0&&(Me.__webglTexture=i.createTexture(),a.memory.textures++)}if(_.samples>0&&de(_)===!1){y.__webglMultisampledFramebuffer=i.createFramebuffer(),y.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,y.__webglMultisampledFramebuffer);for(let ee=0;ee<z.length;ee++){const he=z[ee];y.__webglColorRenderbuffer[ee]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,y.__webglColorRenderbuffer[ee]);const Me=r.convert(he.format,he.colorSpace),J=r.convert(he.type),le=b(he.internalFormat,Me,J,he.colorSpace,_.isXRRenderTarget===!0),Re=Ye(_);i.renderbufferStorageMultisample(i.RENDERBUFFER,Re,le,_.width,_.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ee,i.RENDERBUFFER,y.__webglColorRenderbuffer[ee])}i.bindRenderbuffer(i.RENDERBUFFER,null),_.depthBuffer&&(y.__webglDepthRenderbuffer=i.createRenderbuffer(),be(y.__webglDepthRenderbuffer,_,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(H){t.bindTexture(i.TEXTURE_CUBE_MAP,L.__webglTexture),Ie(i.TEXTURE_CUBE_MAP,f);for(let ee=0;ee<6;ee++)if(f.mipmaps&&f.mipmaps.length>0)for(let he=0;he<f.mipmaps.length;he++)pe(y.__webglFramebuffer[ee][he],_,f,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,he);else pe(y.__webglFramebuffer[ee],_,f,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0);g(f)&&u(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ie){for(let ee=0,he=z.length;ee<he;ee++){const Me=z[ee],J=n.get(Me);let le=i.TEXTURE_2D;(_.isWebGL3DRenderTarget||_.isWebGLArrayRenderTarget)&&(le=_.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(le,J.__webglTexture),Ie(le,Me),pe(y.__webglFramebuffer,_,Me,i.COLOR_ATTACHMENT0+ee,le,0),g(Me)&&u(le)}t.unbindTexture()}else{let ee=i.TEXTURE_2D;if((_.isWebGL3DRenderTarget||_.isWebGLArrayRenderTarget)&&(ee=_.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ee,L.__webglTexture),Ie(ee,f),f.mipmaps&&f.mipmaps.length>0)for(let he=0;he<f.mipmaps.length;he++)pe(y.__webglFramebuffer[he],_,f,i.COLOR_ATTACHMENT0,ee,he);else pe(y.__webglFramebuffer,_,f,i.COLOR_ATTACHMENT0,ee,0);g(f)&&u(ee),t.unbindTexture()}_.depthBuffer&&He(_)}function et(_){const f=_.textures;for(let y=0,L=f.length;y<L;y++){const z=f[y];if(g(z)){const H=A(_),ie=n.get(z).__webglTexture;t.bindTexture(H,ie),u(H),t.unbindTexture()}}}const Pe=[],Se=[];function ge(_){if(_.samples>0){if(de(_)===!1){const f=_.textures,y=_.width,L=_.height;let z=i.COLOR_BUFFER_BIT;const H=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ie=n.get(_),ee=f.length>1;if(ee)for(let Me=0;Me<f.length;Me++)t.bindFramebuffer(i.FRAMEBUFFER,ie.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,ie.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,ie.__webglMultisampledFramebuffer);const he=_.texture.mipmaps;he&&he.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ie.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ie.__webglFramebuffer);for(let Me=0;Me<f.length;Me++){if(_.resolveDepthBuffer&&(_.depthBuffer&&(z|=i.DEPTH_BUFFER_BIT),_.stencilBuffer&&_.resolveStencilBuffer&&(z|=i.STENCIL_BUFFER_BIT)),ee){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ie.__webglColorRenderbuffer[Me]);const J=n.get(f[Me]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,J,0)}i.blitFramebuffer(0,0,y,L,0,0,y,L,z,i.NEAREST),l===!0&&(Pe.length=0,Se.length=0,Pe.push(i.COLOR_ATTACHMENT0+Me),_.depthBuffer&&_.resolveDepthBuffer===!1&&(Pe.push(H),Se.push(H),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Se)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Pe))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ee)for(let Me=0;Me<f.length;Me++){t.bindFramebuffer(i.FRAMEBUFFER,ie.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.RENDERBUFFER,ie.__webglColorRenderbuffer[Me]);const J=n.get(f[Me]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,ie.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Me,i.TEXTURE_2D,J,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ie.__webglMultisampledFramebuffer)}else if(_.depthBuffer&&_.resolveDepthBuffer===!1&&l){const f=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[f])}}}function Ye(_){return Math.min(s.maxSamples,_.samples)}function de(_){const f=n.get(_);return _.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&f.__useRenderToTexture!==!1}function Ne(_){const f=a.render.frame;d.get(_)!==f&&(d.set(_,f),_.update())}function ht(_,f){const y=_.colorSpace,L=_.format,z=_.type;return _.isCompressedTexture===!0||_.isVideoTexture===!0||y!==Ei&&y!==wn&&(qe.getTransfer(y)===Ze?(L!==Xt||z!==an)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",y)),f}function st(_){return typeof HTMLImageElement<"u"&&_ instanceof HTMLImageElement?(c.width=_.naturalWidth||_.width,c.height=_.naturalHeight||_.height):typeof VideoFrame<"u"&&_ instanceof VideoFrame?(c.width=_.displayWidth,c.height=_.displayHeight):(c.width=_.width,c.height=_.height),c}this.allocateTextureUnit=k,this.resetTextureUnits=B,this.setTexture2D=q,this.setTexture2DArray=X,this.setTexture3D=Z,this.setTextureCube=W,this.rebindTextures=vt,this.setupRenderTarget=w,this.updateRenderTargetMipmap=et,this.updateMultisampleRenderTarget=ge,this.setupDepthRenderbuffer=He,this.setupFrameBufferTexture=pe,this.useMultisampledRTT=de}function Fm(i,e){function t(n,s=wn){let r;const a=qe.getTransfer(s);if(n===an)return i.UNSIGNED_BYTE;if(n===La)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Ia)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Cc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Pc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===wc)return i.BYTE;if(n===Rc)return i.SHORT;if(n===qi)return i.UNSIGNED_SHORT;if(n===Da)return i.INT;if(n===qn)return i.UNSIGNED_INT;if(n===gn)return i.FLOAT;if(n===es)return i.HALF_FLOAT;if(n===Dc)return i.ALPHA;if(n===Lc)return i.RGB;if(n===Xt)return i.RGBA;if(n===Yi)return i.DEPTH_COMPONENT;if(n===ji)return i.DEPTH_STENCIL;if(n===Ic)return i.RED;if(n===Na)return i.RED_INTEGER;if(n===Nc)return i.RG;if(n===Ua)return i.RG_INTEGER;if(n===Fa)return i.RGBA_INTEGER;if(n===Ls||n===Is||n===Ns||n===Us)if(a===Ze)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Ls)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Is)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ns)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Us)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Ls)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Is)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ns)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Us)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Jr||n===Qr||n===ea||n===ta)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Jr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Qr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===ea)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===ta)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===na||n===ia||n===sa)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===na||n===ia)return a===Ze?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===sa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===ra||n===aa||n===oa||n===ca||n===la||n===ua||n===ha||n===da||n===fa||n===pa||n===ma||n===ga||n===_a||n===va)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===ra)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===aa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===oa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===ca)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===la)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ua)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ha)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===da)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===fa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===pa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ma)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ga)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===_a)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===va)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===xa||n===Ma||n===ya)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===xa)return a===Ze?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Ma)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ya)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Sa||n===Ea||n===Ta||n===ba)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===Sa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ea)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ta)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===ba)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===$i?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const Om=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Bm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class zm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Yc(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Dn({vertexShader:Om,fragmentShader:Bm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new it(new js(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class km extends Kn{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,d=null,h=null,p=null,m=null,v=null;const x=typeof XRWebGLBinding<"u",g=new zm,u={},A=t.getContextAttributes();let b=null,E=null;const D=[],R=[],P=new De;let U=null;const T=new kt;T.viewport=new ut;const S=new kt;S.viewport=new ut;const C=[T,S],B=new ih;let k=null,$=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let j=D[Y];return j===void 0&&(j=new Tr,D[Y]=j),j.getTargetRaySpace()},this.getControllerGrip=function(Y){let j=D[Y];return j===void 0&&(j=new Tr,D[Y]=j),j.getGripSpace()},this.getHand=function(Y){let j=D[Y];return j===void 0&&(j=new Tr,D[Y]=j),j.getHandSpace()};function q(Y){const j=R.indexOf(Y.inputSource);if(j===-1)return;const pe=D[j];pe!==void 0&&(pe.update(Y.inputSource,Y.frame,c||a),pe.dispatchEvent({type:Y.type,data:Y.inputSource}))}function X(){s.removeEventListener("select",q),s.removeEventListener("selectstart",q),s.removeEventListener("selectend",q),s.removeEventListener("squeeze",q),s.removeEventListener("squeezestart",q),s.removeEventListener("squeezeend",q),s.removeEventListener("end",X),s.removeEventListener("inputsourceschange",Z);for(let Y=0;Y<D.length;Y++){const j=R[Y];j!==null&&(R[Y]=null,D[Y].disconnect(j))}k=null,$=null,g.reset();for(const Y in u)delete u[Y];e.setRenderTarget(b),m=null,p=null,h=null,s=null,E=null,Ve.stop(),n.isPresenting=!1,e.setPixelRatio(U),e.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return p!==null?p:m},this.getBinding=function(){return h===null&&x&&(h=new XRWebGLBinding(s,t)),h},this.getFrame=function(){return v},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(b=e.getRenderTarget(),s.addEventListener("select",q),s.addEventListener("selectstart",q),s.addEventListener("selectend",q),s.addEventListener("squeeze",q),s.addEventListener("squeezestart",q),s.addEventListener("squeezeend",q),s.addEventListener("end",X),s.addEventListener("inputsourceschange",Z),A.xrCompatible!==!0&&await t.makeXRCompatible(),U=e.getPixelRatio(),e.getSize(P),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let pe=null,be=null,xe=null;A.depth&&(xe=A.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,pe=A.stencil?ji:Yi,be=A.stencil?$i:qn);const He={colorFormat:t.RGBA8,depthFormat:xe,scaleFactor:r};h=this.getBinding(),p=h.createProjectionLayer(He),s.updateRenderState({layers:[p]}),e.setPixelRatio(1),e.setSize(p.textureWidth,p.textureHeight,!1),E=new Yn(p.textureWidth,p.textureHeight,{format:Xt,type:an,depthTexture:new $c(p.textureWidth,p.textureHeight,be,void 0,void 0,void 0,void 0,void 0,void 0,pe),stencilBuffer:A.stencil,colorSpace:e.outputColorSpace,samples:A.antialias?4:0,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}else{const pe={antialias:A.antialias,alpha:!0,depth:A.depth,stencil:A.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(s,t,pe),s.updateRenderState({baseLayer:m}),e.setPixelRatio(1),e.setSize(m.framebufferWidth,m.framebufferHeight,!1),E=new Yn(m.framebufferWidth,m.framebufferHeight,{format:Xt,type:an,colorSpace:e.outputColorSpace,stencilBuffer:A.stencil,resolveDepthBuffer:m.ignoreDepthValues===!1,resolveStencilBuffer:m.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Ve.setContext(s),Ve.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function Z(Y){for(let j=0;j<Y.removed.length;j++){const pe=Y.removed[j],be=R.indexOf(pe);be>=0&&(R[be]=null,D[be].disconnect(pe))}for(let j=0;j<Y.added.length;j++){const pe=Y.added[j];let be=R.indexOf(pe);if(be===-1){for(let He=0;He<D.length;He++)if(He>=R.length){R.push(pe),be=He;break}else if(R[He]===null){R[He]=pe,be=He;break}if(be===-1)break}const xe=D[be];xe&&xe.connect(pe)}}const W=new N,se=new N;function ue(Y,j,pe){W.setFromMatrixPosition(j.matrixWorld),se.setFromMatrixPosition(pe.matrixWorld);const be=W.distanceTo(se),xe=j.projectionMatrix.elements,He=pe.projectionMatrix.elements,vt=xe[14]/(xe[10]-1),w=xe[14]/(xe[10]+1),et=(xe[9]+1)/xe[5],Pe=(xe[9]-1)/xe[5],Se=(xe[8]-1)/xe[0],ge=(He[8]+1)/He[0],Ye=vt*Se,de=vt*ge,Ne=be/(-Se+ge),ht=Ne*-Se;if(j.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(ht),Y.translateZ(Ne),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),xe[10]===-1)Y.projectionMatrix.copy(j.projectionMatrix),Y.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{const st=vt+Ne,_=w+Ne,f=Ye-ht,y=de+(be-ht),L=et*w/_*st,z=Pe*w/_*st;Y.projectionMatrix.makePerspective(f,y,L,z,st,_),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function ve(Y,j){j===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(j.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let j=Y.near,pe=Y.far;g.texture!==null&&(g.depthNear>0&&(j=g.depthNear),g.depthFar>0&&(pe=g.depthFar)),B.near=S.near=T.near=j,B.far=S.far=T.far=pe,(k!==B.near||$!==B.far)&&(s.updateRenderState({depthNear:B.near,depthFar:B.far}),k=B.near,$=B.far),B.layers.mask=Y.layers.mask|6,T.layers.mask=B.layers.mask&3,S.layers.mask=B.layers.mask&5;const be=Y.parent,xe=B.cameras;ve(B,be);for(let He=0;He<xe.length;He++)ve(xe[He],be);xe.length===2?ue(B,T,S):B.projectionMatrix.copy(T.projectionMatrix),Ie(Y,B,be)};function Ie(Y,j,pe){pe===null?Y.matrix.copy(j.matrixWorld):(Y.matrix.copy(pe.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(j.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(j.projectionMatrix),Y.projectionMatrixInverse.copy(j.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Ki*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return B},this.getFoveation=function(){if(!(p===null&&m===null))return l},this.setFoveation=function(Y){l=Y,p!==null&&(p.fixedFoveation=Y),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=Y)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(B)},this.getCameraTexture=function(Y){return u[Y]};let We=null;function $e(Y,j){if(d=j.getViewerPose(c||a),v=j,d!==null){const pe=d.views;m!==null&&(e.setRenderTargetFramebuffer(E,m.framebuffer),e.setRenderTarget(E));let be=!1;pe.length!==B.cameras.length&&(B.cameras.length=0,be=!0);for(let w=0;w<pe.length;w++){const et=pe[w];let Pe=null;if(m!==null)Pe=m.getViewport(et);else{const ge=h.getViewSubImage(p,et);Pe=ge.viewport,w===0&&(e.setRenderTargetTextures(E,ge.colorTexture,ge.depthStencilTexture),e.setRenderTarget(E))}let Se=C[w];Se===void 0&&(Se=new kt,Se.layers.enable(w),Se.viewport=new ut,C[w]=Se),Se.matrix.fromArray(et.transform.matrix),Se.matrix.decompose(Se.position,Se.quaternion,Se.scale),Se.projectionMatrix.fromArray(et.projectionMatrix),Se.projectionMatrixInverse.copy(Se.projectionMatrix).invert(),Se.viewport.set(Pe.x,Pe.y,Pe.width,Pe.height),w===0&&(B.matrix.copy(Se.matrix),B.matrix.decompose(B.position,B.quaternion,B.scale)),be===!0&&B.cameras.push(Se)}const xe=s.enabledFeatures;if(xe&&xe.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&x){h=n.getBinding();const w=h.getDepthInformation(pe[0]);w&&w.isValid&&w.texture&&g.init(w,s.renderState)}if(xe&&xe.includes("camera-access")&&x){e.state.unbindTexture(),h=n.getBinding();for(let w=0;w<pe.length;w++){const et=pe[w].camera;if(et){let Pe=u[et];Pe||(Pe=new Yc,u[et]=Pe);const Se=h.getCameraImage(et);Pe.sourceTexture=Se}}}}for(let pe=0;pe<D.length;pe++){const be=R[pe],xe=D[pe];be!==null&&xe!==void 0&&xe.update(be,j,c||a)}We&&We(Y,j),j.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:j}),v=null}const Ve=new Zc;Ve.setAnimationLoop($e),this.setAnimationLoop=function(Y){We=Y},this.dispose=function(){}}}const kn=new on,Hm=new ot;function Gm(i,e){function t(g,u){g.matrixAutoUpdate===!0&&g.updateMatrix(),u.value.copy(g.matrix)}function n(g,u){u.color.getRGB(g.fogColor.value,Vc(i)),u.isFog?(g.fogNear.value=u.near,g.fogFar.value=u.far):u.isFogExp2&&(g.fogDensity.value=u.density)}function s(g,u,A,b,E){u.isMeshBasicMaterial||u.isMeshLambertMaterial?r(g,u):u.isMeshToonMaterial?(r(g,u),h(g,u)):u.isMeshPhongMaterial?(r(g,u),d(g,u)):u.isMeshStandardMaterial?(r(g,u),p(g,u),u.isMeshPhysicalMaterial&&m(g,u,E)):u.isMeshMatcapMaterial?(r(g,u),v(g,u)):u.isMeshDepthMaterial?r(g,u):u.isMeshDistanceMaterial?(r(g,u),x(g,u)):u.isMeshNormalMaterial?r(g,u):u.isLineBasicMaterial?(a(g,u),u.isLineDashedMaterial&&o(g,u)):u.isPointsMaterial?l(g,u,A,b):u.isSpriteMaterial?c(g,u):u.isShadowMaterial?(g.color.value.copy(u.color),g.opacity.value=u.opacity):u.isShaderMaterial&&(u.uniformsNeedUpdate=!1)}function r(g,u){g.opacity.value=u.opacity,u.color&&g.diffuse.value.copy(u.color),u.emissive&&g.emissive.value.copy(u.emissive).multiplyScalar(u.emissiveIntensity),u.map&&(g.map.value=u.map,t(u.map,g.mapTransform)),u.alphaMap&&(g.alphaMap.value=u.alphaMap,t(u.alphaMap,g.alphaMapTransform)),u.bumpMap&&(g.bumpMap.value=u.bumpMap,t(u.bumpMap,g.bumpMapTransform),g.bumpScale.value=u.bumpScale,u.side===Ct&&(g.bumpScale.value*=-1)),u.normalMap&&(g.normalMap.value=u.normalMap,t(u.normalMap,g.normalMapTransform),g.normalScale.value.copy(u.normalScale),u.side===Ct&&g.normalScale.value.negate()),u.displacementMap&&(g.displacementMap.value=u.displacementMap,t(u.displacementMap,g.displacementMapTransform),g.displacementScale.value=u.displacementScale,g.displacementBias.value=u.displacementBias),u.emissiveMap&&(g.emissiveMap.value=u.emissiveMap,t(u.emissiveMap,g.emissiveMapTransform)),u.specularMap&&(g.specularMap.value=u.specularMap,t(u.specularMap,g.specularMapTransform)),u.alphaTest>0&&(g.alphaTest.value=u.alphaTest);const A=e.get(u),b=A.envMap,E=A.envMapRotation;b&&(g.envMap.value=b,kn.copy(E),kn.x*=-1,kn.y*=-1,kn.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(kn.y*=-1,kn.z*=-1),g.envMapRotation.value.setFromMatrix4(Hm.makeRotationFromEuler(kn)),g.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=u.reflectivity,g.ior.value=u.ior,g.refractionRatio.value=u.refractionRatio),u.lightMap&&(g.lightMap.value=u.lightMap,g.lightMapIntensity.value=u.lightMapIntensity,t(u.lightMap,g.lightMapTransform)),u.aoMap&&(g.aoMap.value=u.aoMap,g.aoMapIntensity.value=u.aoMapIntensity,t(u.aoMap,g.aoMapTransform))}function a(g,u){g.diffuse.value.copy(u.color),g.opacity.value=u.opacity,u.map&&(g.map.value=u.map,t(u.map,g.mapTransform))}function o(g,u){g.dashSize.value=u.dashSize,g.totalSize.value=u.dashSize+u.gapSize,g.scale.value=u.scale}function l(g,u,A,b){g.diffuse.value.copy(u.color),g.opacity.value=u.opacity,g.size.value=u.size*A,g.scale.value=b*.5,u.map&&(g.map.value=u.map,t(u.map,g.uvTransform)),u.alphaMap&&(g.alphaMap.value=u.alphaMap,t(u.alphaMap,g.alphaMapTransform)),u.alphaTest>0&&(g.alphaTest.value=u.alphaTest)}function c(g,u){g.diffuse.value.copy(u.color),g.opacity.value=u.opacity,g.rotation.value=u.rotation,u.map&&(g.map.value=u.map,t(u.map,g.mapTransform)),u.alphaMap&&(g.alphaMap.value=u.alphaMap,t(u.alphaMap,g.alphaMapTransform)),u.alphaTest>0&&(g.alphaTest.value=u.alphaTest)}function d(g,u){g.specular.value.copy(u.specular),g.shininess.value=Math.max(u.shininess,1e-4)}function h(g,u){u.gradientMap&&(g.gradientMap.value=u.gradientMap)}function p(g,u){g.metalness.value=u.metalness,u.metalnessMap&&(g.metalnessMap.value=u.metalnessMap,t(u.metalnessMap,g.metalnessMapTransform)),g.roughness.value=u.roughness,u.roughnessMap&&(g.roughnessMap.value=u.roughnessMap,t(u.roughnessMap,g.roughnessMapTransform)),u.envMap&&(g.envMapIntensity.value=u.envMapIntensity)}function m(g,u,A){g.ior.value=u.ior,u.sheen>0&&(g.sheenColor.value.copy(u.sheenColor).multiplyScalar(u.sheen),g.sheenRoughness.value=u.sheenRoughness,u.sheenColorMap&&(g.sheenColorMap.value=u.sheenColorMap,t(u.sheenColorMap,g.sheenColorMapTransform)),u.sheenRoughnessMap&&(g.sheenRoughnessMap.value=u.sheenRoughnessMap,t(u.sheenRoughnessMap,g.sheenRoughnessMapTransform))),u.clearcoat>0&&(g.clearcoat.value=u.clearcoat,g.clearcoatRoughness.value=u.clearcoatRoughness,u.clearcoatMap&&(g.clearcoatMap.value=u.clearcoatMap,t(u.clearcoatMap,g.clearcoatMapTransform)),u.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=u.clearcoatRoughnessMap,t(u.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),u.clearcoatNormalMap&&(g.clearcoatNormalMap.value=u.clearcoatNormalMap,t(u.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(u.clearcoatNormalScale),u.side===Ct&&g.clearcoatNormalScale.value.negate())),u.dispersion>0&&(g.dispersion.value=u.dispersion),u.iridescence>0&&(g.iridescence.value=u.iridescence,g.iridescenceIOR.value=u.iridescenceIOR,g.iridescenceThicknessMinimum.value=u.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=u.iridescenceThicknessRange[1],u.iridescenceMap&&(g.iridescenceMap.value=u.iridescenceMap,t(u.iridescenceMap,g.iridescenceMapTransform)),u.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=u.iridescenceThicknessMap,t(u.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),u.transmission>0&&(g.transmission.value=u.transmission,g.transmissionSamplerMap.value=A.texture,g.transmissionSamplerSize.value.set(A.width,A.height),u.transmissionMap&&(g.transmissionMap.value=u.transmissionMap,t(u.transmissionMap,g.transmissionMapTransform)),g.thickness.value=u.thickness,u.thicknessMap&&(g.thicknessMap.value=u.thicknessMap,t(u.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=u.attenuationDistance,g.attenuationColor.value.copy(u.attenuationColor)),u.anisotropy>0&&(g.anisotropyVector.value.set(u.anisotropy*Math.cos(u.anisotropyRotation),u.anisotropy*Math.sin(u.anisotropyRotation)),u.anisotropyMap&&(g.anisotropyMap.value=u.anisotropyMap,t(u.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=u.specularIntensity,g.specularColor.value.copy(u.specularColor),u.specularColorMap&&(g.specularColorMap.value=u.specularColorMap,t(u.specularColorMap,g.specularColorMapTransform)),u.specularIntensityMap&&(g.specularIntensityMap.value=u.specularIntensityMap,t(u.specularIntensityMap,g.specularIntensityMapTransform))}function v(g,u){u.matcap&&(g.matcap.value=u.matcap)}function x(g,u){const A=e.get(u).light;g.referencePosition.value.setFromMatrixPosition(A.matrixWorld),g.nearDistance.value=A.shadow.camera.near,g.farDistance.value=A.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Vm(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(A,b){const E=b.program;n.uniformBlockBinding(A,E)}function c(A,b){let E=s[A.id];E===void 0&&(v(A),E=d(A),s[A.id]=E,A.addEventListener("dispose",g));const D=b.program;n.updateUBOMapping(A,D);const R=e.render.frame;r[A.id]!==R&&(p(A),r[A.id]=R)}function d(A){const b=h();A.__bindingPointIndex=b;const E=i.createBuffer(),D=A.__size,R=A.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,D,R),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,E),E}function h(){for(let A=0;A<o;A++)if(a.indexOf(A)===-1)return a.push(A),A;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function p(A){const b=s[A.id],E=A.uniforms,D=A.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let R=0,P=E.length;R<P;R++){const U=Array.isArray(E[R])?E[R]:[E[R]];for(let T=0,S=U.length;T<S;T++){const C=U[T];if(m(C,R,T,D)===!0){const B=C.__offset,k=Array.isArray(C.value)?C.value:[C.value];let $=0;for(let q=0;q<k.length;q++){const X=k[q],Z=x(X);typeof X=="number"||typeof X=="boolean"?(C.__data[0]=X,i.bufferSubData(i.UNIFORM_BUFFER,B+$,C.__data)):X.isMatrix3?(C.__data[0]=X.elements[0],C.__data[1]=X.elements[1],C.__data[2]=X.elements[2],C.__data[3]=0,C.__data[4]=X.elements[3],C.__data[5]=X.elements[4],C.__data[6]=X.elements[5],C.__data[7]=0,C.__data[8]=X.elements[6],C.__data[9]=X.elements[7],C.__data[10]=X.elements[8],C.__data[11]=0):(X.toArray(C.__data,$),$+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,B,C.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function m(A,b,E,D){const R=A.value,P=b+"_"+E;if(D[P]===void 0)return typeof R=="number"||typeof R=="boolean"?D[P]=R:D[P]=R.clone(),!0;{const U=D[P];if(typeof R=="number"||typeof R=="boolean"){if(U!==R)return D[P]=R,!0}else if(U.equals(R)===!1)return U.copy(R),!0}return!1}function v(A){const b=A.uniforms;let E=0;const D=16;for(let P=0,U=b.length;P<U;P++){const T=Array.isArray(b[P])?b[P]:[b[P]];for(let S=0,C=T.length;S<C;S++){const B=T[S],k=Array.isArray(B.value)?B.value:[B.value];for(let $=0,q=k.length;$<q;$++){const X=k[$],Z=x(X),W=E%D,se=W%Z.boundary,ue=W+se;E+=se,ue!==0&&D-ue<Z.storage&&(E+=D-ue),B.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),B.__offset=E,E+=Z.storage}}}const R=E%D;return R>0&&(E+=D-R),A.__size=E,A.__cache={},this}function x(A){const b={boundary:0,storage:0};return typeof A=="number"||typeof A=="boolean"?(b.boundary=4,b.storage=4):A.isVector2?(b.boundary=8,b.storage=8):A.isVector3||A.isColor?(b.boundary=16,b.storage=12):A.isVector4?(b.boundary=16,b.storage=16):A.isMatrix3?(b.boundary=48,b.storage=48):A.isMatrix4?(b.boundary=64,b.storage=64):A.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",A),b}function g(A){const b=A.target;b.removeEventListener("dispose",g);const E=a.indexOf(b.__bindingPointIndex);a.splice(E,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function u(){for(const A in s)i.deleteBuffer(s[A]);a=[],s={},r={}}return{bind:l,update:c,dispose:u}}class Wm{constructor(e={}){const{canvas:t=Mu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:p=!1}=e;this.isWebGLRenderer=!0;let m;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=n.getContextAttributes().alpha}else m=a;const v=new Uint32Array(4),x=new Int32Array(4);let g=null,u=null;const A=[],b=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Cn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const E=this;let D=!1;this._outputColorSpace=Nt;let R=0,P=0,U=null,T=-1,S=null;const C=new ut,B=new ut;let k=null;const $=new Fe(0);let q=0,X=t.width,Z=t.height,W=1,se=null,ue=null;const ve=new ut(0,0,X,Z),Ie=new ut(0,0,X,Z);let We=!1;const $e=new ka;let Ve=!1,Y=!1;const j=new ot,pe=new N,be=new ut,xe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let He=!1;function vt(){return U===null?W:1}let w=n;function et(M,F){return t.getContext(M,F)}try{const M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Pa}`),t.addEventListener("webglcontextlost",re,!1),t.addEventListener("webglcontextrestored",me,!1),t.addEventListener("webglcontextcreationerror",Q,!1),w===null){const F="webgl2";if(w=et(F,M),w===null)throw et(F)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}let Pe,Se,ge,Ye,de,Ne,ht,st,_,f,y,L,z,H,ie,ee,he,Me,J,le,Re,Ee,oe,Oe;function I(){Pe=new ep(w),Pe.init(),Ee=new Fm(w,Pe),Se=new $f(w,Pe,e,Ee),ge=new Nm(w,Pe),Se.reversedDepthBuffer&&p&&ge.buffers.depth.setReversed(!0),Ye=new ip(w),de=new ym,Ne=new Um(w,Pe,ge,de,Se,Ee,Ye),ht=new jf(E),st=new Qf(E),_=new ch(w),oe=new Xf(w,_),f=new tp(w,_,Ye,oe),y=new rp(w,f,_,Ye),J=new sp(w,Se,Ne),ee=new Yf(de),L=new Mm(E,ht,st,Pe,Se,oe,ee),z=new Gm(E,de),H=new Em,ie=new Cm(Pe),Me=new Wf(E,ht,st,ge,y,m,l),he=new Lm(E,y,Se),Oe=new Vm(w,Ye,Se,ge),le=new qf(w,Pe,Ye),Re=new np(w,Pe,Ye),Ye.programs=L.programs,E.capabilities=Se,E.extensions=Pe,E.properties=de,E.renderLists=H,E.shadowMap=he,E.state=ge,E.info=Ye}I();const ne=new km(E,w);this.xr=ne,this.getContext=function(){return w},this.getContextAttributes=function(){return w.getContextAttributes()},this.forceContextLoss=function(){const M=Pe.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){const M=Pe.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return W},this.setPixelRatio=function(M){M!==void 0&&(W=M,this.setSize(X,Z,!1))},this.getSize=function(M){return M.set(X,Z)},this.setSize=function(M,F,G=!0){if(ne.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}X=M,Z=F,t.width=Math.floor(M*W),t.height=Math.floor(F*W),G===!0&&(t.style.width=M+"px",t.style.height=F+"px"),this.setViewport(0,0,M,F)},this.getDrawingBufferSize=function(M){return M.set(X*W,Z*W).floor()},this.setDrawingBufferSize=function(M,F,G){X=M,Z=F,W=G,t.width=Math.floor(M*G),t.height=Math.floor(F*G),this.setViewport(0,0,M,F)},this.getCurrentViewport=function(M){return M.copy(C)},this.getViewport=function(M){return M.copy(ve)},this.setViewport=function(M,F,G,V){M.isVector4?ve.set(M.x,M.y,M.z,M.w):ve.set(M,F,G,V),ge.viewport(C.copy(ve).multiplyScalar(W).round())},this.getScissor=function(M){return M.copy(Ie)},this.setScissor=function(M,F,G,V){M.isVector4?Ie.set(M.x,M.y,M.z,M.w):Ie.set(M,F,G,V),ge.scissor(B.copy(Ie).multiplyScalar(W).round())},this.getScissorTest=function(){return We},this.setScissorTest=function(M){ge.setScissorTest(We=M)},this.setOpaqueSort=function(M){se=M},this.setTransparentSort=function(M){ue=M},this.getClearColor=function(M){return M.copy(Me.getClearColor())},this.setClearColor=function(){Me.setClearColor(...arguments)},this.getClearAlpha=function(){return Me.getClearAlpha()},this.setClearAlpha=function(){Me.setClearAlpha(...arguments)},this.clear=function(M=!0,F=!0,G=!0){let V=0;if(M){let O=!1;if(U!==null){const te=U.texture.format;O=te===Fa||te===Ua||te===Na}if(O){const te=U.texture.type,ce=te===an||te===qn||te===qi||te===$i||te===La||te===Ia,_e=Me.getClearColor(),fe=Me.getClearAlpha(),we=_e.r,Ce=_e.g,Te=_e.b;ce?(v[0]=we,v[1]=Ce,v[2]=Te,v[3]=fe,w.clearBufferuiv(w.COLOR,0,v)):(x[0]=we,x[1]=Ce,x[2]=Te,x[3]=fe,w.clearBufferiv(w.COLOR,0,x))}else V|=w.COLOR_BUFFER_BIT}F&&(V|=w.DEPTH_BUFFER_BIT),G&&(V|=w.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),w.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",re,!1),t.removeEventListener("webglcontextrestored",me,!1),t.removeEventListener("webglcontextcreationerror",Q,!1),Me.dispose(),H.dispose(),ie.dispose(),de.dispose(),ht.dispose(),st.dispose(),y.dispose(),oe.dispose(),Oe.dispose(),L.dispose(),ne.dispose(),ne.removeEventListener("sessionstart",Zt),ne.removeEventListener("sessionend",eo),In.stop()};function re(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),D=!0}function me(){console.log("THREE.WebGLRenderer: Context Restored."),D=!1;const M=Ye.autoReset,F=he.enabled,G=he.autoUpdate,V=he.needsUpdate,O=he.type;I(),Ye.autoReset=M,he.enabled=F,he.autoUpdate=G,he.needsUpdate=V,he.type=O}function Q(M){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function K(M){const F=M.target;F.removeEventListener("dispose",K),ye(F)}function ye(M){Le(M),de.remove(M)}function Le(M){const F=de.get(M).programs;F!==void 0&&(F.forEach(function(G){L.releaseProgram(G)}),M.isShaderMaterial&&L.releaseShaderCache(M))}this.renderBufferDirect=function(M,F,G,V,O,te){F===null&&(F=xe);const ce=O.isMesh&&O.matrixWorld.determinant()<0,_e=fl(M,F,G,V,O);ge.setMaterial(V,ce);let fe=G.index,we=1;if(V.wireframe===!0){if(fe=f.getWireframeAttribute(G),fe===void 0)return;we=2}const Ce=G.drawRange,Te=G.attributes.position;let Ge=Ce.start*we,Ke=(Ce.start+Ce.count)*we;te!==null&&(Ge=Math.max(Ge,te.start*we),Ke=Math.min(Ke,(te.start+te.count)*we)),fe!==null?(Ge=Math.max(Ge,0),Ke=Math.min(Ke,fe.count)):Te!=null&&(Ge=Math.max(Ge,0),Ke=Math.min(Ke,Te.count));const lt=Ke-Ge;if(lt<0||lt===1/0)return;oe.setup(O,V,_e,G,fe);let nt,Qe=le;if(fe!==null&&(nt=_.get(fe),Qe=Re,Qe.setIndex(nt)),O.isMesh)V.wireframe===!0?(ge.setLineWidth(V.wireframeLinewidth*vt()),Qe.setMode(w.LINES)):Qe.setMode(w.TRIANGLES);else if(O.isLine){let Ae=V.linewidth;Ae===void 0&&(Ae=1),ge.setLineWidth(Ae*vt()),O.isLineSegments?Qe.setMode(w.LINES):O.isLineLoop?Qe.setMode(w.LINE_LOOP):Qe.setMode(w.LINE_STRIP)}else O.isPoints?Qe.setMode(w.POINTS):O.isSprite&&Qe.setMode(w.TRIANGLES);if(O.isBatchedMesh)if(O._multiDrawInstances!==null)Zi("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),Qe.renderMultiDrawInstances(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount,O._multiDrawInstances);else if(Pe.get("WEBGL_multi_draw"))Qe.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{const Ae=O._multiDrawStarts,rt=O._multiDrawCounts,Xe=O._multiDrawCount,Pt=fe?_.get(fe).bytesPerElement:1,Jn=de.get(V).currentProgram.getUniforms();for(let Dt=0;Dt<Xe;Dt++)Jn.setValue(w,"_gl_DrawID",Dt),Qe.render(Ae[Dt]/Pt,rt[Dt])}else if(O.isInstancedMesh)Qe.renderInstances(Ge,lt,O.count);else if(G.isInstancedBufferGeometry){const Ae=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,rt=Math.min(G.instanceCount,Ae);Qe.renderInstances(Ge,lt,rt)}else Qe.render(Ge,lt)};function tt(M,F,G){M.transparent===!0&&M.side===mn&&M.forceSinglePass===!1?(M.side=Ct,M.needsUpdate=!0,ss(M,F,G),M.side=Pn,M.needsUpdate=!0,ss(M,F,G),M.side=mn):ss(M,F,G)}this.compile=function(M,F,G=null){G===null&&(G=M),u=ie.get(G),u.init(F),b.push(u),G.traverseVisible(function(O){O.isLight&&O.layers.test(F.layers)&&(u.pushLight(O),O.castShadow&&u.pushShadow(O))}),M!==G&&M.traverseVisible(function(O){O.isLight&&O.layers.test(F.layers)&&(u.pushLight(O),O.castShadow&&u.pushShadow(O))}),u.setupLights();const V=new Set;return M.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;const te=O.material;if(te)if(Array.isArray(te))for(let ce=0;ce<te.length;ce++){const _e=te[ce];tt(_e,G,O),V.add(_e)}else tt(te,G,O),V.add(te)}),u=b.pop(),V},this.compileAsync=function(M,F,G=null){const V=this.compile(M,F,G);return new Promise(O=>{function te(){if(V.forEach(function(ce){de.get(ce).currentProgram.isReady()&&V.delete(ce)}),V.size===0){O(M);return}setTimeout(te,10)}Pe.get("KHR_parallel_shader_compile")!==null?te():setTimeout(te,10)})};let je=null;function cn(M){je&&je(M)}function Zt(){In.stop()}function eo(){In.start()}const In=new Zc;In.setAnimationLoop(cn),typeof self<"u"&&In.setContext(self),this.setAnimationLoop=function(M){je=M,ne.setAnimationLoop(M),M===null?In.stop():In.start()},ne.addEventListener("sessionstart",Zt),ne.addEventListener("sessionend",eo),this.render=function(M,F){if(F!==void 0&&F.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),ne.enabled===!0&&ne.isPresenting===!0&&(ne.cameraAutoUpdate===!0&&ne.updateCamera(F),F=ne.getCamera()),M.isScene===!0&&M.onBeforeRender(E,M,F,U),u=ie.get(M,b.length),u.init(F),b.push(u),j.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),$e.setFromProjectionMatrix(j,nn,F.reversedDepth),Y=this.localClippingEnabled,Ve=ee.init(this.clippingPlanes,Y),g=H.get(M,A.length),g.init(),A.push(g),ne.enabled===!0&&ne.isPresenting===!0){const te=E.xr.getDepthSensingMesh();te!==null&&tr(te,F,-1/0,E.sortObjects)}tr(M,F,0,E.sortObjects),g.finish(),E.sortObjects===!0&&g.sort(se,ue),He=ne.enabled===!1||ne.isPresenting===!1||ne.hasDepthSensing()===!1,He&&Me.addToRenderList(g,M),this.info.render.frame++,Ve===!0&&ee.beginShadows();const G=u.state.shadowsArray;he.render(G,M,F),Ve===!0&&ee.endShadows(),this.info.autoReset===!0&&this.info.reset();const V=g.opaque,O=g.transmissive;if(u.setupLights(),F.isArrayCamera){const te=F.cameras;if(O.length>0)for(let ce=0,_e=te.length;ce<_e;ce++){const fe=te[ce];no(V,O,M,fe)}He&&Me.render(M);for(let ce=0,_e=te.length;ce<_e;ce++){const fe=te[ce];to(g,M,fe,fe.viewport)}}else O.length>0&&no(V,O,M,F),He&&Me.render(M),to(g,M,F);U!==null&&P===0&&(Ne.updateMultisampleRenderTarget(U),Ne.updateRenderTargetMipmap(U)),M.isScene===!0&&M.onAfterRender(E,M,F),oe.resetDefaultState(),T=-1,S=null,b.pop(),b.length>0?(u=b[b.length-1],Ve===!0&&ee.setGlobalState(E.clippingPlanes,u.state.camera)):u=null,A.pop(),A.length>0?g=A[A.length-1]:g=null};function tr(M,F,G,V){if(M.visible===!1)return;if(M.layers.test(F.layers)){if(M.isGroup)G=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(F);else if(M.isLight)u.pushLight(M),M.castShadow&&u.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||$e.intersectsSprite(M)){V&&be.setFromMatrixPosition(M.matrixWorld).applyMatrix4(j);const ce=y.update(M),_e=M.material;_e.visible&&g.push(M,ce,_e,G,be.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||$e.intersectsObject(M))){const ce=y.update(M),_e=M.material;if(V&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),be.copy(M.boundingSphere.center)):(ce.boundingSphere===null&&ce.computeBoundingSphere(),be.copy(ce.boundingSphere.center)),be.applyMatrix4(M.matrixWorld).applyMatrix4(j)),Array.isArray(_e)){const fe=ce.groups;for(let we=0,Ce=fe.length;we<Ce;we++){const Te=fe[we],Ge=_e[Te.materialIndex];Ge&&Ge.visible&&g.push(M,ce,Ge,G,be.z,Te)}}else _e.visible&&g.push(M,ce,_e,G,be.z,null)}}const te=M.children;for(let ce=0,_e=te.length;ce<_e;ce++)tr(te[ce],F,G,V)}function to(M,F,G,V){const O=M.opaque,te=M.transmissive,ce=M.transparent;u.setupLightsView(G),Ve===!0&&ee.setGlobalState(E.clippingPlanes,G),V&&ge.viewport(C.copy(V)),O.length>0&&is(O,F,G),te.length>0&&is(te,F,G),ce.length>0&&is(ce,F,G),ge.buffers.depth.setTest(!0),ge.buffers.depth.setMask(!0),ge.buffers.color.setMask(!0),ge.setPolygonOffset(!1)}function no(M,F,G,V){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;u.state.transmissionRenderTarget[V.id]===void 0&&(u.state.transmissionRenderTarget[V.id]=new Yn(1,1,{generateMipmaps:!0,type:Pe.has("EXT_color_buffer_half_float")||Pe.has("EXT_color_buffer_float")?es:an,minFilter:Xn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:qe.workingColorSpace}));const te=u.state.transmissionRenderTarget[V.id],ce=V.viewport||C;te.setSize(ce.z*E.transmissionResolutionScale,ce.w*E.transmissionResolutionScale);const _e=E.getRenderTarget(),fe=E.getActiveCubeFace(),we=E.getActiveMipmapLevel();E.setRenderTarget(te),E.getClearColor($),q=E.getClearAlpha(),q<1&&E.setClearColor(16777215,.5),E.clear(),He&&Me.render(G);const Ce=E.toneMapping;E.toneMapping=Cn;const Te=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),u.setupLightsView(V),Ve===!0&&ee.setGlobalState(E.clippingPlanes,V),is(M,G,V),Ne.updateMultisampleRenderTarget(te),Ne.updateRenderTargetMipmap(te),Pe.has("WEBGL_multisampled_render_to_texture")===!1){let Ge=!1;for(let Ke=0,lt=F.length;Ke<lt;Ke++){const nt=F[Ke],Qe=nt.object,Ae=nt.geometry,rt=nt.material,Xe=nt.group;if(rt.side===mn&&Qe.layers.test(V.layers)){const Pt=rt.side;rt.side=Ct,rt.needsUpdate=!0,io(Qe,G,V,Ae,rt,Xe),rt.side=Pt,rt.needsUpdate=!0,Ge=!0}}Ge===!0&&(Ne.updateMultisampleRenderTarget(te),Ne.updateRenderTargetMipmap(te))}E.setRenderTarget(_e,fe,we),E.setClearColor($,q),Te!==void 0&&(V.viewport=Te),E.toneMapping=Ce}function is(M,F,G){const V=F.isScene===!0?F.overrideMaterial:null;for(let O=0,te=M.length;O<te;O++){const ce=M[O],_e=ce.object,fe=ce.geometry,we=ce.group;let Ce=ce.material;Ce.allowOverride===!0&&V!==null&&(Ce=V),_e.layers.test(G.layers)&&io(_e,F,G,fe,Ce,we)}}function io(M,F,G,V,O,te){M.onBeforeRender(E,F,G,V,O,te),M.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),O.onBeforeRender(E,F,G,V,M,te),O.transparent===!0&&O.side===mn&&O.forceSinglePass===!1?(O.side=Ct,O.needsUpdate=!0,E.renderBufferDirect(G,F,V,O,M,te),O.side=Pn,O.needsUpdate=!0,E.renderBufferDirect(G,F,V,O,M,te),O.side=mn):E.renderBufferDirect(G,F,V,O,M,te),M.onAfterRender(E,F,G,V,O,te)}function ss(M,F,G){F.isScene!==!0&&(F=xe);const V=de.get(M),O=u.state.lights,te=u.state.shadowsArray,ce=O.state.version,_e=L.getParameters(M,O.state,te,F,G),fe=L.getProgramCacheKey(_e);let we=V.programs;V.environment=M.isMeshStandardMaterial?F.environment:null,V.fog=F.fog,V.envMap=(M.isMeshStandardMaterial?st:ht).get(M.envMap||V.environment),V.envMapRotation=V.environment!==null&&M.envMap===null?F.environmentRotation:M.envMapRotation,we===void 0&&(M.addEventListener("dispose",K),we=new Map,V.programs=we);let Ce=we.get(fe);if(Ce!==void 0){if(V.currentProgram===Ce&&V.lightsStateVersion===ce)return ro(M,_e),Ce}else _e.uniforms=L.getUniforms(M),M.onBeforeCompile(_e,E),Ce=L.acquireProgram(_e,fe),we.set(fe,Ce),V.uniforms=_e.uniforms;const Te=V.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Te.clippingPlanes=ee.uniform),ro(M,_e),V.needsLights=ml(M),V.lightsStateVersion=ce,V.needsLights&&(Te.ambientLightColor.value=O.state.ambient,Te.lightProbe.value=O.state.probe,Te.directionalLights.value=O.state.directional,Te.directionalLightShadows.value=O.state.directionalShadow,Te.spotLights.value=O.state.spot,Te.spotLightShadows.value=O.state.spotShadow,Te.rectAreaLights.value=O.state.rectArea,Te.ltc_1.value=O.state.rectAreaLTC1,Te.ltc_2.value=O.state.rectAreaLTC2,Te.pointLights.value=O.state.point,Te.pointLightShadows.value=O.state.pointShadow,Te.hemisphereLights.value=O.state.hemi,Te.directionalShadowMap.value=O.state.directionalShadowMap,Te.directionalShadowMatrix.value=O.state.directionalShadowMatrix,Te.spotShadowMap.value=O.state.spotShadowMap,Te.spotLightMatrix.value=O.state.spotLightMatrix,Te.spotLightMap.value=O.state.spotLightMap,Te.pointShadowMap.value=O.state.pointShadowMap,Te.pointShadowMatrix.value=O.state.pointShadowMatrix),V.currentProgram=Ce,V.uniformsList=null,Ce}function so(M){if(M.uniformsList===null){const F=M.currentProgram.getUniforms();M.uniformsList=Fs.seqWithValue(F.seq,M.uniforms)}return M.uniformsList}function ro(M,F){const G=de.get(M);G.outputColorSpace=F.outputColorSpace,G.batching=F.batching,G.batchingColor=F.batchingColor,G.instancing=F.instancing,G.instancingColor=F.instancingColor,G.instancingMorph=F.instancingMorph,G.skinning=F.skinning,G.morphTargets=F.morphTargets,G.morphNormals=F.morphNormals,G.morphColors=F.morphColors,G.morphTargetsCount=F.morphTargetsCount,G.numClippingPlanes=F.numClippingPlanes,G.numIntersection=F.numClipIntersection,G.vertexAlphas=F.vertexAlphas,G.vertexTangents=F.vertexTangents,G.toneMapping=F.toneMapping}function fl(M,F,G,V,O){F.isScene!==!0&&(F=xe),Ne.resetTextureUnits();const te=F.fog,ce=V.isMeshStandardMaterial?F.environment:null,_e=U===null?E.outputColorSpace:U.isXRRenderTarget===!0?U.texture.colorSpace:Ei,fe=(V.isMeshStandardMaterial?st:ht).get(V.envMap||ce),we=V.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,Ce=!!G.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),Te=!!G.morphAttributes.position,Ge=!!G.morphAttributes.normal,Ke=!!G.morphAttributes.color;let lt=Cn;V.toneMapped&&(U===null||U.isXRRenderTarget===!0)&&(lt=E.toneMapping);const nt=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,Qe=nt!==void 0?nt.length:0,Ae=de.get(V),rt=u.state.lights;if(Ve===!0&&(Y===!0||M!==S)){const Et=M===S&&V.id===T;ee.setState(V,M,Et)}let Xe=!1;V.version===Ae.__version?(Ae.needsLights&&Ae.lightsStateVersion!==rt.state.version||Ae.outputColorSpace!==_e||O.isBatchedMesh&&Ae.batching===!1||!O.isBatchedMesh&&Ae.batching===!0||O.isBatchedMesh&&Ae.batchingColor===!0&&O.colorTexture===null||O.isBatchedMesh&&Ae.batchingColor===!1&&O.colorTexture!==null||O.isInstancedMesh&&Ae.instancing===!1||!O.isInstancedMesh&&Ae.instancing===!0||O.isSkinnedMesh&&Ae.skinning===!1||!O.isSkinnedMesh&&Ae.skinning===!0||O.isInstancedMesh&&Ae.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&Ae.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&Ae.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&Ae.instancingMorph===!1&&O.morphTexture!==null||Ae.envMap!==fe||V.fog===!0&&Ae.fog!==te||Ae.numClippingPlanes!==void 0&&(Ae.numClippingPlanes!==ee.numPlanes||Ae.numIntersection!==ee.numIntersection)||Ae.vertexAlphas!==we||Ae.vertexTangents!==Ce||Ae.morphTargets!==Te||Ae.morphNormals!==Ge||Ae.morphColors!==Ke||Ae.toneMapping!==lt||Ae.morphTargetsCount!==Qe)&&(Xe=!0):(Xe=!0,Ae.__version=V.version);let Pt=Ae.currentProgram;Xe===!0&&(Pt=ss(V,F,O));let Jn=!1,Dt=!1,Pi=!1;const at=Pt.getUniforms(),Ft=Ae.uniforms;if(ge.useProgram(Pt.program)&&(Jn=!0,Dt=!0,Pi=!0),V.id!==T&&(T=V.id,Dt=!0),Jn||S!==M){ge.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),at.setValue(w,"projectionMatrix",M.projectionMatrix),at.setValue(w,"viewMatrix",M.matrixWorldInverse);const wt=at.map.cameraPosition;wt!==void 0&&wt.setValue(w,pe.setFromMatrixPosition(M.matrixWorld)),Se.logarithmicDepthBuffer&&at.setValue(w,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&at.setValue(w,"isOrthographic",M.isOrthographicCamera===!0),S!==M&&(S=M,Dt=!0,Pi=!0)}if(O.isSkinnedMesh){at.setOptional(w,O,"bindMatrix"),at.setOptional(w,O,"bindMatrixInverse");const Et=O.skeleton;Et&&(Et.boneTexture===null&&Et.computeBoneTexture(),at.setValue(w,"boneTexture",Et.boneTexture,Ne))}O.isBatchedMesh&&(at.setOptional(w,O,"batchingTexture"),at.setValue(w,"batchingTexture",O._matricesTexture,Ne),at.setOptional(w,O,"batchingIdTexture"),at.setValue(w,"batchingIdTexture",O._indirectTexture,Ne),at.setOptional(w,O,"batchingColorTexture"),O._colorsTexture!==null&&at.setValue(w,"batchingColorTexture",O._colorsTexture,Ne));const Ot=G.morphAttributes;if((Ot.position!==void 0||Ot.normal!==void 0||Ot.color!==void 0)&&J.update(O,G,Pt),(Dt||Ae.receiveShadow!==O.receiveShadow)&&(Ae.receiveShadow=O.receiveShadow,at.setValue(w,"receiveShadow",O.receiveShadow)),V.isMeshGouraudMaterial&&V.envMap!==null&&(Ft.envMap.value=fe,Ft.flipEnvMap.value=fe.isCubeTexture&&fe.isRenderTargetTexture===!1?-1:1),V.isMeshStandardMaterial&&V.envMap===null&&F.environment!==null&&(Ft.envMapIntensity.value=F.environmentIntensity),Dt&&(at.setValue(w,"toneMappingExposure",E.toneMappingExposure),Ae.needsLights&&pl(Ft,Pi),te&&V.fog===!0&&z.refreshFogUniforms(Ft,te),z.refreshMaterialUniforms(Ft,V,W,Z,u.state.transmissionRenderTarget[M.id]),Fs.upload(w,so(Ae),Ft,Ne)),V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(Fs.upload(w,so(Ae),Ft,Ne),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&at.setValue(w,"center",O.center),at.setValue(w,"modelViewMatrix",O.modelViewMatrix),at.setValue(w,"normalMatrix",O.normalMatrix),at.setValue(w,"modelMatrix",O.matrixWorld),V.isShaderMaterial||V.isRawShaderMaterial){const Et=V.uniformsGroups;for(let wt=0,nr=Et.length;wt<nr;wt++){const Nn=Et[wt];Oe.update(Nn,Pt),Oe.bind(Nn,Pt)}}return Pt}function pl(M,F){M.ambientLightColor.needsUpdate=F,M.lightProbe.needsUpdate=F,M.directionalLights.needsUpdate=F,M.directionalLightShadows.needsUpdate=F,M.pointLights.needsUpdate=F,M.pointLightShadows.needsUpdate=F,M.spotLights.needsUpdate=F,M.spotLightShadows.needsUpdate=F,M.rectAreaLights.needsUpdate=F,M.hemisphereLights.needsUpdate=F}function ml(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return R},this.getActiveMipmapLevel=function(){return P},this.getRenderTarget=function(){return U},this.setRenderTargetTextures=function(M,F,G){const V=de.get(M);V.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,V.__autoAllocateDepthBuffer===!1&&(V.__useRenderToTexture=!1),de.get(M.texture).__webglTexture=F,de.get(M.depthTexture).__webglTexture=V.__autoAllocateDepthBuffer?void 0:G,V.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,F){const G=de.get(M);G.__webglFramebuffer=F,G.__useDefaultFramebuffer=F===void 0};const gl=w.createFramebuffer();this.setRenderTarget=function(M,F=0,G=0){U=M,R=F,P=G;let V=!0,O=null,te=!1,ce=!1;if(M){const fe=de.get(M);if(fe.__useDefaultFramebuffer!==void 0)ge.bindFramebuffer(w.FRAMEBUFFER,null),V=!1;else if(fe.__webglFramebuffer===void 0)Ne.setupRenderTarget(M);else if(fe.__hasExternalTextures)Ne.rebindTextures(M,de.get(M.texture).__webglTexture,de.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){const Te=M.depthTexture;if(fe.__boundDepthTexture!==Te){if(Te!==null&&de.has(Te)&&(M.width!==Te.image.width||M.height!==Te.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Ne.setupDepthRenderbuffer(M)}}const we=M.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(ce=!0);const Ce=de.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(Ce[F])?O=Ce[F][G]:O=Ce[F],te=!0):M.samples>0&&Ne.useMultisampledRTT(M)===!1?O=de.get(M).__webglMultisampledFramebuffer:Array.isArray(Ce)?O=Ce[G]:O=Ce,C.copy(M.viewport),B.copy(M.scissor),k=M.scissorTest}else C.copy(ve).multiplyScalar(W).floor(),B.copy(Ie).multiplyScalar(W).floor(),k=We;if(G!==0&&(O=gl),ge.bindFramebuffer(w.FRAMEBUFFER,O)&&V&&ge.drawBuffers(M,O),ge.viewport(C),ge.scissor(B),ge.setScissorTest(k),te){const fe=de.get(M.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_CUBE_MAP_POSITIVE_X+F,fe.__webglTexture,G)}else if(ce){const fe=F;for(let we=0;we<M.textures.length;we++){const Ce=de.get(M.textures[we]);w.framebufferTextureLayer(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0+we,Ce.__webglTexture,G,fe)}}else if(M!==null&&G!==0){const fe=de.get(M.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,fe.__webglTexture,G)}T=-1},this.readRenderTargetPixels=function(M,F,G,V,O,te,ce,_e=0){if(!(M&&M.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let fe=de.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe){ge.bindFramebuffer(w.FRAMEBUFFER,fe);try{const we=M.textures[_e],Ce=we.format,Te=we.type;if(!Se.textureFormatReadable(Ce)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Se.textureTypeReadable(Te)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=M.width-V&&G>=0&&G<=M.height-O&&(M.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+_e),w.readPixels(F,G,V,O,Ee.convert(Ce),Ee.convert(Te),te))}finally{const we=U!==null?de.get(U).__webglFramebuffer:null;ge.bindFramebuffer(w.FRAMEBUFFER,we)}}},this.readRenderTargetPixelsAsync=async function(M,F,G,V,O,te,ce,_e=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let fe=de.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe)if(F>=0&&F<=M.width-V&&G>=0&&G<=M.height-O){ge.bindFramebuffer(w.FRAMEBUFFER,fe);const we=M.textures[_e],Ce=we.format,Te=we.type;if(!Se.textureFormatReadable(Ce))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Se.textureTypeReadable(Te))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ge=w.createBuffer();w.bindBuffer(w.PIXEL_PACK_BUFFER,Ge),w.bufferData(w.PIXEL_PACK_BUFFER,te.byteLength,w.STREAM_READ),M.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+_e),w.readPixels(F,G,V,O,Ee.convert(Ce),Ee.convert(Te),0);const Ke=U!==null?de.get(U).__webglFramebuffer:null;ge.bindFramebuffer(w.FRAMEBUFFER,Ke);const lt=w.fenceSync(w.SYNC_GPU_COMMANDS_COMPLETE,0);return w.flush(),await yu(w,lt,4),w.bindBuffer(w.PIXEL_PACK_BUFFER,Ge),w.getBufferSubData(w.PIXEL_PACK_BUFFER,0,te),w.deleteBuffer(Ge),w.deleteSync(lt),te}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,F=null,G=0){const V=Math.pow(2,-G),O=Math.floor(M.image.width*V),te=Math.floor(M.image.height*V),ce=F!==null?F.x:0,_e=F!==null?F.y:0;Ne.setTexture2D(M,0),w.copyTexSubImage2D(w.TEXTURE_2D,G,0,0,ce,_e,O,te),ge.unbindTexture()};const _l=w.createFramebuffer(),vl=w.createFramebuffer();this.copyTextureToTexture=function(M,F,G=null,V=null,O=0,te=null){te===null&&(O!==0?(Zi("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),te=O,O=0):te=0);let ce,_e,fe,we,Ce,Te,Ge,Ke,lt;const nt=M.isCompressedTexture?M.mipmaps[te]:M.image;if(G!==null)ce=G.max.x-G.min.x,_e=G.max.y-G.min.y,fe=G.isBox3?G.max.z-G.min.z:1,we=G.min.x,Ce=G.min.y,Te=G.isBox3?G.min.z:0;else{const Ot=Math.pow(2,-O);ce=Math.floor(nt.width*Ot),_e=Math.floor(nt.height*Ot),M.isDataArrayTexture?fe=nt.depth:M.isData3DTexture?fe=Math.floor(nt.depth*Ot):fe=1,we=0,Ce=0,Te=0}V!==null?(Ge=V.x,Ke=V.y,lt=V.z):(Ge=0,Ke=0,lt=0);const Qe=Ee.convert(F.format),Ae=Ee.convert(F.type);let rt;F.isData3DTexture?(Ne.setTexture3D(F,0),rt=w.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(Ne.setTexture2DArray(F,0),rt=w.TEXTURE_2D_ARRAY):(Ne.setTexture2D(F,0),rt=w.TEXTURE_2D),w.pixelStorei(w.UNPACK_FLIP_Y_WEBGL,F.flipY),w.pixelStorei(w.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),w.pixelStorei(w.UNPACK_ALIGNMENT,F.unpackAlignment);const Xe=w.getParameter(w.UNPACK_ROW_LENGTH),Pt=w.getParameter(w.UNPACK_IMAGE_HEIGHT),Jn=w.getParameter(w.UNPACK_SKIP_PIXELS),Dt=w.getParameter(w.UNPACK_SKIP_ROWS),Pi=w.getParameter(w.UNPACK_SKIP_IMAGES);w.pixelStorei(w.UNPACK_ROW_LENGTH,nt.width),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,nt.height),w.pixelStorei(w.UNPACK_SKIP_PIXELS,we),w.pixelStorei(w.UNPACK_SKIP_ROWS,Ce),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Te);const at=M.isDataArrayTexture||M.isData3DTexture,Ft=F.isDataArrayTexture||F.isData3DTexture;if(M.isDepthTexture){const Ot=de.get(M),Et=de.get(F),wt=de.get(Ot.__renderTarget),nr=de.get(Et.__renderTarget);ge.bindFramebuffer(w.READ_FRAMEBUFFER,wt.__webglFramebuffer),ge.bindFramebuffer(w.DRAW_FRAMEBUFFER,nr.__webglFramebuffer);for(let Nn=0;Nn<fe;Nn++)at&&(w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,de.get(M).__webglTexture,O,Te+Nn),w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,de.get(F).__webglTexture,te,lt+Nn)),w.blitFramebuffer(we,Ce,ce,_e,Ge,Ke,ce,_e,w.DEPTH_BUFFER_BIT,w.NEAREST);ge.bindFramebuffer(w.READ_FRAMEBUFFER,null),ge.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else if(O!==0||M.isRenderTargetTexture||de.has(M)){const Ot=de.get(M),Et=de.get(F);ge.bindFramebuffer(w.READ_FRAMEBUFFER,_l),ge.bindFramebuffer(w.DRAW_FRAMEBUFFER,vl);for(let wt=0;wt<fe;wt++)at?w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Ot.__webglTexture,O,Te+wt):w.framebufferTexture2D(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Ot.__webglTexture,O),Ft?w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Et.__webglTexture,te,lt+wt):w.framebufferTexture2D(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Et.__webglTexture,te),O!==0?w.blitFramebuffer(we,Ce,ce,_e,Ge,Ke,ce,_e,w.COLOR_BUFFER_BIT,w.NEAREST):Ft?w.copyTexSubImage3D(rt,te,Ge,Ke,lt+wt,we,Ce,ce,_e):w.copyTexSubImage2D(rt,te,Ge,Ke,we,Ce,ce,_e);ge.bindFramebuffer(w.READ_FRAMEBUFFER,null),ge.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else Ft?M.isDataTexture||M.isData3DTexture?w.texSubImage3D(rt,te,Ge,Ke,lt,ce,_e,fe,Qe,Ae,nt.data):F.isCompressedArrayTexture?w.compressedTexSubImage3D(rt,te,Ge,Ke,lt,ce,_e,fe,Qe,nt.data):w.texSubImage3D(rt,te,Ge,Ke,lt,ce,_e,fe,Qe,Ae,nt):M.isDataTexture?w.texSubImage2D(w.TEXTURE_2D,te,Ge,Ke,ce,_e,Qe,Ae,nt.data):M.isCompressedTexture?w.compressedTexSubImage2D(w.TEXTURE_2D,te,Ge,Ke,nt.width,nt.height,Qe,nt.data):w.texSubImage2D(w.TEXTURE_2D,te,Ge,Ke,ce,_e,Qe,Ae,nt);w.pixelStorei(w.UNPACK_ROW_LENGTH,Xe),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,Pt),w.pixelStorei(w.UNPACK_SKIP_PIXELS,Jn),w.pixelStorei(w.UNPACK_SKIP_ROWS,Dt),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Pi),te===0&&F.generateMipmaps&&w.generateMipmap(rt),ge.unbindTexture()},this.initRenderTarget=function(M){de.get(M).__webglFramebuffer===void 0&&Ne.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?Ne.setTextureCube(M,0):M.isData3DTexture?Ne.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?Ne.setTexture2DArray(M,0):Ne.setTexture2D(M,0),ge.unbindTexture()},this.resetState=function(){R=0,P=0,U=null,ge.reset(),oe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=qe._getDrawingBufferColorSpace(e),t.unpackColorSpace=qe._getUnpackColorSpace()}}const dc={type:"change"},Xa={type:"start"},nl={type:"end"},Rs=new $s,fc=new An,Xm=Math.cos(70*Hs.DEG2RAD),mt=new N,Rt=2*Math.PI,Je={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Ur=1e-6;class qm extends ah{constructor(e,t=null){super(e,t),this.state=Je.NONE,this.target=new N,this.cursor=new N,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:gi.ROTATE,MIDDLE:gi.DOLLY,RIGHT:gi.PAN},this.touches={ONE:pi.ROTATE,TWO:pi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new N,this._lastQuaternion=new $n,this._lastTargetPosition=new N,this._quat=new $n().setFromUnitVectors(e.up,new N(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new ko,this._sphericalDelta=new ko,this._scale=1,this._panOffset=new N,this._rotateStart=new De,this._rotateEnd=new De,this._rotateDelta=new De,this._panStart=new De,this._panEnd=new De,this._panDelta=new De,this._dollyStart=new De,this._dollyEnd=new De,this._dollyDelta=new De,this._dollyDirection=new N,this._mouse=new De,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Ym.bind(this),this._onPointerDown=$m.bind(this),this._onPointerUp=jm.bind(this),this._onContextMenu=ng.bind(this),this._onMouseWheel=Jm.bind(this),this._onKeyDown=Qm.bind(this),this._onTouchStart=eg.bind(this),this._onTouchMove=tg.bind(this),this._onMouseDown=Km.bind(this),this._onMouseMove=Zm.bind(this),this._interceptControlDown=ig.bind(this),this._interceptControlUp=sg.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(dc),this.update(),this.state=Je.NONE}update(e=null){const t=this.object.position;mt.copy(t).sub(this.target),mt.applyQuaternion(this._quat),this._spherical.setFromVector3(mt),this.autoRotate&&this.state===Je.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=Rt:n>Math.PI&&(n-=Rt),s<-Math.PI?s+=Rt:s>Math.PI&&(s-=Rt),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(mt.setFromSpherical(this._spherical),mt.applyQuaternion(this._quatInverse),t.copy(this.target).add(mt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){const o=mt.length();a=this._clampDistance(o*this._scale);const l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){const o=new N(this._mouse.x,this._mouse.y,0);o.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;const c=new N(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=mt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(Rs.origin.copy(this.object.position),Rs.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Rs.direction))<Xm?this.object.lookAt(this.target):(fc.setFromNormalAndCoplanarPoint(this.object.up,this.target),Rs.intersectPlane(fc,this.target))))}else if(this.object.isOrthographicCamera){const a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Ur||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Ur||this._lastTargetPosition.distanceToSquared(this.target)>Ur?(this.dispatchEvent(dc),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?Rt/60*this.autoRotateSpeed*e:Rt/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){mt.setFromMatrixColumn(t,0),mt.multiplyScalar(-e),this._panOffset.add(mt)}_panUp(e,t){this.screenSpacePanning===!0?mt.setFromMatrixColumn(t,1):(mt.setFromMatrixColumn(t,0),mt.crossVectors(this.object.up,mt)),mt.multiplyScalar(e),this._panOffset.add(mt)}_pan(e,t){const n=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;mt.copy(s).sub(this.target);let r=mt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const n=this.domElement.getBoundingClientRect(),s=e-n.left,r=t-n.top,a=n.width,o=n.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Rt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Rt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(Rt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-Rt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(Rt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-Rt*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(n,s)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),s=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Rt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Rt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new De,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}}function $m(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function Ym(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function jm(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(nl),this.state=Je.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Km(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case gi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=Je.DOLLY;break;case gi.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Je.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Je.ROTATE}break;case gi.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Je.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Je.PAN}break;default:this.state=Je.NONE}this.state!==Je.NONE&&this.dispatchEvent(Xa)}function Zm(i){switch(this.state){case Je.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case Je.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case Je.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function Jm(i){this.enabled===!1||this.enableZoom===!1||this.state!==Je.NONE||(i.preventDefault(),this.dispatchEvent(Xa),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(nl))}function Qm(i){this.enabled!==!1&&this._handleKeyDown(i)}function eg(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case pi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=Je.TOUCH_ROTATE;break;case pi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=Je.TOUCH_PAN;break;default:this.state=Je.NONE}break;case 2:switch(this.touches.TWO){case pi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=Je.TOUCH_DOLLY_PAN;break;case pi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=Je.TOUCH_DOLLY_ROTATE;break;default:this.state=Je.NONE}break;default:this.state=Je.NONE}this.state!==Je.NONE&&this.dispatchEvent(Xa)}function tg(i){switch(this._trackPointer(i),this.state){case Je.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case Je.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case Je.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case Je.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=Je.NONE}}function ng(i){this.enabled!==!1&&i.preventDefault()}function ig(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function sg(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function rg(i="neutral"){const e=new qt;e.name="AI Classmate Educational Robot look-dev lights";const t=new eh(i==="reference"?16773334:15922431,3554114,i==="grazing"?.28:i==="reference"?.72:.85);e.add(t);const n=new Rr(i==="reference"?16764810:16774376,i==="grazing"?4.2:i==="reference"?2.6:2.15);i==="grazing"?n.position.set(7.5,1.1,4):i==="reference"?n.position.set(-4.5,7.5,5):n.position.set(-4,6,5.5),n.castShadow=!0,n.shadow.mapSize.set(4096,4096),n.shadow.bias=-25e-5,n.shadow.normalBias=.018,n.shadow.radius=7,n.shadow.blurSamples=24,n.shadow.camera.near=.5,n.shadow.camera.far=30,n.shadow.camera.left=-2.6,n.shadow.camera.right=2.6,n.shadow.camera.top=2.6,n.shadow.camera.bottom=-2.6,n.shadow.camera.updateProjectionMatrix(),e.add(n);const s=new Rr(11060479,i==="grazing"?.12:.42);s.position.set(4,3,3.5),e.add(s);const r=new Rr(16773572,i==="grazing"?.28:.85);return r.position.set(.5,4.5,-6),e.add(r),e.userData.reviewMode=i,e.userData.lightingFromPhoto=["key light: 左前上方大面积柔光，形成头壳和肩部的柔和高光。","fill light: 正面偏右低强度填充，保留深蓝面板细节。","rim light: 后上方冷色轮廓光，分离天线与头壳轮廓。","exposure: 中性略高曝光；tone mapping: ACES/Filmic。","background: 浅灰白无纹理背景。","contact shadow: 双脚与地面、关节接缝处保留软接触阴影。"],e.userData.lookDevTargets={qualityPriority:"reference-fidelity",materialPass:{albedoPaletteRequired:!0,roughnessVariationRequired:!0,normalOrBumpRequired:!0,localOverridesRequired:!0,minimumTextureResolution:1024,preferredTextureResolution:2048,independentMapChannels:["albedo","roughness","height","normal","ambient-occlusion"],requiredSurfaceFrequencyBands:["macro","meso","micro"],geometryReliefRequiredWhenSilhouetteAffected:!0,referencePbrExtraction:{requiredWhenSourceImagePresent:!0,targetThreshold:.7,stopOnLowConfidence:!0,script:"forge/stage1_intake/extract_pbr_evidence.py",acceptedLimitation:"single-image extraction is reference-derived inference, not exact photogrammetry"},mustAvoid:["single flat albedo per material","uniform roughness","albedo texture reused as roughness/height/normal/AO","single-frequency random noise","plastic-looking smooth bark, stone, cloth, foliage, or aged material","local color/detail described only in prose without material masks","claiming exact PBR recovery when confidence is below the target threshold"]},lightingPass:{requiredTerms:["key light","fill light","rim or environment light","exposure","tone mapping","background","contact shadow"],mustAvoid:["ambient-only lighting","flat value range","missing contact shadow","reference lighting copied without separating material readability"]},screenshotReview:["Compare albedo palette and local color zones.","Compare roughness/normal/bump response under light.","Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.","Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.","Capture a neutral-light render to verify material readability without reference lighting.","Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.","Capture a reference-matched render from the same camera framing as the source."]},e}function ag(i,e,t={}){const n=new vn().setFromObject(e);if(n.isEmpty())return;const s=n.getSize(new N),r=n.getCenter(new N),a=t.margin??1.15,o=Math.max(s.x,s.y,s.z)*a,l=i.fov*Math.PI/180,c=o/2/Math.tan(l/2),d=(t.azimuthDeg??0)*Math.PI/180,h=(t.elevationDeg??0)*Math.PI/180,p=new N(Math.sin(d)*Math.cos(h),Math.sin(h),Math.cos(d)*Math.cos(h));i.position.copy(r).addScaledVector(p,c),i.near=Math.max(.01,c-o),i.far=c+o*2,i.lookAt(r),i.updateProjectionMatrix()}function og(i){i.toneMapping=bc,i.outputColorSpace=Nt}function cg(i,e){const t=new qm(i,e);return t.enableDamping=!0,t.minDistance=1,t.maxDistance=8,t.autoRotate=!1,t}const Fi=new N;function zt(i,e,t,n,s,r){const a=2*Math.PI*s/4,o=Math.max(r-2*s,0),l=Math.PI/4;Fi.copy(e),Fi[n]=0,Fi.normalize();const c=.5*a/(a+o),d=1-Fi.angleTo(i)/l;return Math.sign(Fi[t])===1?d*c:o/(a+o)+c+c*(1-d)}class ts extends wi{constructor(e=1,t=1,n=1,s=2,r=.1){const a=s*2+1;if(r=Math.min(e/2,t/2,n/2,r),super(1,1,1,a,a,a),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:n,segments:s,radius:r},a===1)return;const o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;const l=new N,c=new N,d=new N(e,t,n).divideScalar(2).subScalar(r),h=this.attributes.position.array,p=this.attributes.normal.array,m=this.attributes.uv.array,v=h.length/6,x=new N,g=.5/a;for(let u=0,A=0;u<h.length;u+=3,A+=2)switch(l.fromArray(h,u),c.copy(l),c.x-=Math.sign(c.x)*g,c.y-=Math.sign(c.y)*g,c.z-=Math.sign(c.z)*g,c.normalize(),h[u+0]=d.x*Math.sign(l.x)+c.x*r,h[u+1]=d.y*Math.sign(l.y)+c.y*r,h[u+2]=d.z*Math.sign(l.z)+c.z*r,p[u+0]=c.x,p[u+1]=c.y,p[u+2]=c.z,Math.floor(u/v)){case 0:x.set(1,0,0),m[A+0]=zt(x,c,"z","y",r,n),m[A+1]=1-zt(x,c,"y","z",r,t);break;case 1:x.set(-1,0,0),m[A+0]=1-zt(x,c,"z","y",r,n),m[A+1]=1-zt(x,c,"y","z",r,t);break;case 2:x.set(0,1,0),m[A+0]=1-zt(x,c,"x","z",r,e),m[A+1]=zt(x,c,"z","x",r,n);break;case 3:x.set(0,-1,0),m[A+0]=1-zt(x,c,"x","z",r,e),m[A+1]=1-zt(x,c,"z","x",r,n);break;case 4:x.set(0,0,1),m[A+0]=1-zt(x,c,"x","y",r,e),m[A+1]=1-zt(x,c,"y","x",r,t);break;case 5:x.set(0,0,-1),m[A+0]=zt(x,c,"x","y",r,e),m[A+1]=1-zt(x,c,"y","x",r,t);break}}static fromJSON(e){return new ts(e.width,e.height,e.depth,e.segments,e.radius)}}const il=new Ln({color:"#f2eee5",roughness:.48,clearcoat:.18,clearcoatRoughness:.38}),lg=new Ln({color:"#d8d5cf",roughness:.62}),pc=new Ln({color:"#1b2c46",roughness:.42,clearcoat:.16}),Cs=new Ln({color:"#0f1b2c",roughness:.5}),Fr=new Ln({color:"#2d4361",roughness:.32,metalness:.08}),mc=new Ln({color:"#63e9f1",emissive:"#2dd8e5",emissiveIntensity:2.6,roughness:.2}),gc=new Ln({color:"#1b8c9c",emissive:"#0d6475",emissiveIntensity:1.2,roughness:.3}),ug=new Ln({color:"#101b2c",roughness:.72});function Oi(i,e=.14){return new it(new ts(i[0],i[1],i[2],5,e),il)}function Ps(i,e){return new it(new ts(i[0],i[1],i[2],4,Math.min(i[0],i[1],i[2])*.18),e)}function Bi(i,e){return new it(new Ks(i,32,20),e)}function hg(i,e,t){return new it(new ts(i*2.1,e+i*1.3,i*1.8,4,i*.7),t)}function Or(i,e,t,n=32){return new it(new Ha(i,i,e,n),t)}function dg(i,e,t){return new it(new Ga(i,e,16,48),t)}function ft(i,e,t,n,s){const r=new qt;return r.name=`${t}__pivot`,r.position.set(...n),r.userData.sculptComponent={id:e,name:t,role:e,level:"macro"},r.userData.actionProfile={animationRole:e,pivot:{mode:"semantic-root",axis:[0,1,0]}},i.add(r),r.add(s),r}function fg(i,e){i.traverse(t=>{t instanceof it&&(t.castShadow=e.castShadow??!0,t.receiveShadow=e.receiveShadow??!0,t.material=Array.isArray(t.material)?t.material.map(n=>n.clone()):t.material.clone(),t.geometry.computeVertexNormals())})}function pg(i={}){const e=new qt;e.name="AI同学·课堂三维示意模型",e.userData.actionReadiness={note:"课堂教学用程序化三维示意，不代表真实机器人内部结构。"};const t=ft(e,"root","AI同学整体",[0,0,0],new qt),n=ft(t,"torso","胸腔·系统主板",[0,3.05,0],Ps([1.75,1.75,1.02],pc));ft(n,"chest-core","胸部核心·处理器",[0,.13,.55],Or(.28,.13,Cs)).rotation.x=Math.PI/2,ft(n,"chest-ring","胸部状态环",[0,.13,.64],dg(.38,.07,mc)),ft(n,"abdomen","腹部舱体·存储",[0,-1.03,0],new it(new Ks(.82,36,24),pc)).scale.set(1.02,.72,.82);const s=ft(n,"neck","颈部连接",[0,1.07,0],Or(.28,.34,Cs)),r=ft(s,"head","头部·感知与认知",[0,.76,0],Oi([2.15,1.35,1.06],.22));ft(r,"visor","面部显示窗·表达",[0,0,.55],Ps([1.44,.68,.08],Cs));const a=ft(r,"eye-lights","双眼发光模块",[0,.02,.61],new qt);for(const l of[-.32,.32]){const c=Ps([.16,.3,.035],mc);c.position.set(l,0,0),a.add(c)}for(const l of[-1,1]){const c=l<0?"left":"right",d=l*.6,h=ft(r,`${c}-antenna`,"天线·感知",[d,.84,0],Or(.055,.45,Cs,16));ft(h,`${c}-antenna-tip`,"天线端头",[0,.26,0],Bi(.15,gc))}for(const l of[-1,1]){const c=l<0?"left":"right",d=l*1.16,h=ft(n,`${c}-shoulder`,`${c==="left"?"左":"右"}肩·关节`,[d,.49,0],Bi(.3,il)),p=ft(h,`${c}-upper-arm`,`${c==="left"?"左":"右"}上臂`,[l*.0812,-.49,0],Oi([.48,.76,.54],.12)),m=ft(p,`${c}-elbow`,`${c==="left"?"左":"右"}肘·关节`,[l*.0348,-.5,0],Bi(.22,Fr)),v=ft(m,`${c}-forearm`,`${c==="left"?"左":"右"}前臂`,[0,-.49,0],Oi([.46,.74,.5],.12)),x=ft(v,`${c}-hand`,`${c==="left"?"左":"右"}夹爪·行动`,[0,-.58,0],new qt);x.add(Bi(.2,Fr));for(const b of[-.12,.12]){const E=hg(.075,.28,lg);E.rotation.z=l*.34,E.position.set(b,-.14,.08),x.add(E)}h.userData.mount="arm",p.userData.mount="arm",m.userData.mount="arm",v.userData.mount="arm";const g=ft(n,`${c}-hip`,`${c==="left"?"左":"右"}髋·关节`,[l*.48,-1.7,0],Bi(.27,Fr)),u=ft(g,`${c}-shin`,`${c==="left"?"左":"右"}小腿·行动`,[0,-.57,0],Oi([.58,.9,.68],.13)),A=ft(u,`${c}-foot`,`${c==="left"?"左":"右"}脚·稳定`,[0,-.62,.13],Oi([.82,.34,1.16],.12));ft(A,`${c}-foot-trim`,`${c==="left"?"左":"右"}脚底安全边`,[0,-.14,.03],Ps([.85,.12,1.12],ug))}const o=new it(new Ys(.08,20),gc);return o.position.set(0,.5,-.53),o.rotation.y=Math.PI,n.add(o),fg(e,i),e}function mg(i){const e=new Map,t=new Va({color:"#808080",roughness:1,metalness:0});return{setNeutral(n){i.traverse(s=>{s instanceof it&&(n?(e.has(s)||e.set(s,s.material),s.material=t):e.has(s)&&(s.material=e.get(s)))}),n||e.clear()},exportAudit(){i.updateMatrixWorld(!0);const n=[],s=[],r={};let a=0,o=0,l=0;const c=new Map;return i.traverse(d=>{const h=d.userData.sculptComponent?.id;if(!h)return;const p=d.parent?.userData.sculptComponent?.id??null,m={name:h,displayName:d.name,kind:"part",parent:p,triangles:0,meshes:[],pivot:d.position.toArray(),actionProfile:d.userData.actionProfile??null};c.set(h,m),r[h]=d.getWorldPosition(new N).toArray(),n.push(m)}),i.traverse(d=>{if(!(d instanceof it))return;let h=d;for(;h&&!h.userData.sculptComponent?.id;)h=h.parent;const p=h?.userData.sculptComponent?.id??null;p||a++,d.name||o++;const m=d.geometry,v=m.getAttribute("position"),x=m.getAttribute("normal"),g=new Ue().getNormalMatrix(d.matrixWorld),u=[],A=[];for(let R=0;R<v.count;R++)u.push(new N().fromBufferAttribute(v,R).applyMatrix4(d.matrixWorld).toArray()),x&&A.push(new N().fromBufferAttribute(x,R).applyNormalMatrix(g).toArray());const b=m.index?Array.from(m.index.array):Array.from({length:v.count},(R,P)=>P),E=d.name||`${p??"unowned"}:mesh-${s.length}`,D=Array.isArray(d.material)?d.material:[d.material];for(const R of D)for(const P of Object.values(R))P instanceof At&&l++;s.push({name:E,runtimeName:d.name,componentId:p,vertices:u,indices:b,normals:A,geometryType:m.type}),p&&(c.get(p).triangles+=b.length/3,c.get(p).meshes.push(E))}),{manifest:{model:i.name,source:"src/createClassroomRobot.ts",parts:n,unnamedMeshes:a,anonymousMeshNames:o,integralMeshes:s.length},meshes:s,positions:r,runtime:{hasSculptRuntime:!!i.userData.sculptRuntime,sculptRuntimeKeys:Object.keys(i.userData.sculptRuntime??{}),actionReadiness:i.userData.actionReadiness??null,neutralActive:e.size>0,mappedTextures:l}}}}}const gg={计算模块:[{n:"Intel Core i5-14400",t:"基础",p:1300,d:"文字问答、资料整理、系统控制",params:"基础型 · 10核16线程；集成显卡",i:"💻",c:3900150,id:"p01-01",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Intel Core i5-14400",sourceRow:5,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"AMD Ryzen 5 8600G",t:"基础",p:1250,d:"轻量识图、语音交互",params:"基础型 · 6核12线程＋核显",i:"💻",c:3900150,id:"p01-02",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"AMD Ryzen 5 8600G",sourceRow:6,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"Raspberry Pi 5（8GB）",t:"基础",p:600,d:"入门控制、传感器采集",params:"基础型 · 4核ARM＋8GB内存",i:"💻",c:3900150,id:"p01-03",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Raspberry Pi 5（8GB）",sourceRow:7,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"启思C8（模拟）",t:"基础",p:1200,d:"讲“算力”概念的简化样例",params:"基础型 · 8核通用处理器（虚构）",i:"💻",c:3900150,id:"p01-04",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"启思C8（模拟）",sourceRow:8,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"NVIDIA Jetson Orin Nano Super（8GB）",t:"均衡",p:1600,d:"本地视觉识别、边缘推理",params:"均衡型 · 8GB统一显存；约67 TOPS",i:"🎮",c:9133302,id:"p01-05",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"NVIDIA Jetson Orin Nano Super（8GB）",sourceRow:9,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"华为 Atlas 200I DK A2",t:"均衡",p:2e3,d:"本地推理、国产算力体验",params:"均衡型 · 国产AI开发套件；8 TOPS（INT8）",i:"🎮",c:9133302,id:"p01-06",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"华为 Atlas 200I DK A2",sourceRow:10,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"Intel Core Ultra 7 265K",t:"均衡",p:2600,d:"多任务、本地AI加速",params:"均衡型 · 20核；内置NPU约13 TOPS",i:"💻",c:9133302,id:"p01-07",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Intel Core Ultra 7 265K",sourceRow:11,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"NVIDIA RTX 4060（8GB）",t:"均衡",p:2300,d:"图像生成、本地模型推理",params:"均衡型 · 8GB GDDR6 独立显存",i:"🎮",c:9133302,id:"p01-08",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"NVIDIA RTX 4060（8GB）",sourceRow:12,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"迅绘G12（模拟）",t:"均衡",p:2300,d:"讲CPU与GPU的分工",params:"均衡型 · 8核CPU＋8GB显存（虚构）",i:"🎮",c:9133302,id:"p01-09",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"迅绘G12（模拟）",sourceRow:13,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"NVIDIA RTX 4070 Super（12GB）",t:"增强",p:4600,d:"较大模型本地运行",params:"增强型 · 12GB GDDR6X；高并行算力",i:"🎮",c:15680580,id:"p01-10",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"NVIDIA RTX 4070 Super（12GB）",sourceRow:14,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"融算X60（模拟）",t:"增强",p:7500,d:"讨论堆叠算力的成本",params:"增强型 · 多处理器协同（虚构）",i:"🎮",c:15680580,id:"p01-11",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"融算X60（模拟）",sourceRow:15,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"},{n:"巡天N96（模拟）",t:"增强",p:12e3,d:"对照数据中心讲能耗",params:"增强型 · 机柜级算力集群（虚构）",i:"🎮",c:15680580,id:"p01-12",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"巡天N96（模拟）",sourceRow:16,sourceSheet:"部件选型表",sourceCategory:"计算模块",sourceType:"original-xlsx"}],长期存储:[{n:"闪迪 至尊高速 512GB（SSD）",t:"基础",p:300,d:"装系统与常用资料",params:"基础型 · NVMe 固态 512GB",i:"💾",c:3900150,id:"p02-01",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"闪迪 至尊高速 512GB（SSD）",sourceRow:17,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"西数 SN580 1TB（SSD）",t:"基础",p:450,d:"存模型与素材",params:"基础型 · NVMe 固态 1TB",i:"💾",c:3900150,id:"p02-02",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"西数 SN580 1TB（SSD）",sourceRow:18,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"铠侠 EXCERIA G2 1TB",t:"基础",p:460,d:"存模型与素材",params:"基础型 · NVMe 固态 1TB",i:"💾",c:3900150,id:"p02-03",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"铠侠 EXCERIA G2 1TB",sourceRow:19,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"希捷 酷鱼 2TB（机械硬盘）",t:"基础",p:380,d:"大体积资料归档",params:"基础型 · 3.5寸机械硬盘 2TB",i:"💾",c:3900150,id:"p02-04",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"希捷 酷鱼 2TB（机械硬盘）",sourceRow:20,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"典藏H4（模拟）",t:"基础",p:600,d:"类比“书柜”讲长期保存",params:"基础型 · 大容量机械硬盘（虚构）",i:"💾",c:3900150,id:"p02-05",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"典藏H4（模拟）",sourceRow:21,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"三星 990 PRO 1TB",t:"均衡",p:700,d:"高频读写、装本地模型",params:"均衡型 · NVMe 1TB；读速7450MB/s",i:"💾",c:9133302,id:"p02-06",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"三星 990 PRO 1TB",sourceRow:22,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"三星 990 PRO 2TB",t:"均衡",p:1200,d:"多个模型共存",params:"均衡型 · NVMe 2TB；高速大容量",i:"💾",c:9133302,id:"p02-07",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"三星 990 PRO 2TB",sourceRow:23,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"西数 紫盘 4TB（机械硬盘）",t:"均衡",p:550,d:"长时间连续写入",params:"均衡型 · 监控级机械硬盘 4TB",i:"💾",c:9133302,id:"p02-08",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"西数 紫盘 4TB（机械硬盘）",sourceRow:24,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"三星 T7 1TB（移动固态）",t:"均衡",p:550,d:"跨设备搬运资料",params:"均衡型 · 便携移动固态 1TB",i:"💾",c:9133302,id:"p02-09",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"三星 T7 1TB（移动固态）",sourceRow:25,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"群晖 DS224+（NAS·不含盘）",t:"增强",p:2800,d:"多人共享、自动备份",params:"增强型 · 双盘位网络存储",i:"💾",c:15680580,id:"p02-10",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"群晖 DS224+（NAS·不含盘）",sourceRow:26,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"宏存S2（模拟）",t:"增强",p:1800,d:"讨论集中存储的代价",params:"增强型 · 机架式存储（虚构）",i:"💾",c:15680580,id:"p02-11",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"宏存S2（模拟）",sourceRow:27,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"},{n:"矩阵S2R（模拟）",t:"增强",p:2400,d:"讲可靠性与冗余",params:"增强型 · 双备份存储阵列（虚构）",i:"💾",c:15680580,id:"p02-12",simulated:!0,extension:!1,tags:[],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"矩阵S2R（模拟）",sourceRow:28,sourceSheet:"部件选型表",sourceCategory:"长期存储",sourceType:"original-xlsx"}],运行空间:[{n:"金士顿 DDR4 16GB（3200）",t:"基础",p:220,d:"日常多任务",params:"基础型 · DDR4 16GB 单条",i:"🧠",c:3900150,id:"p03-01",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"金士顿 DDR4 16GB（3200）",sourceRow:29,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"金士顿 DDR5 16GB（5600）",t:"基础",p:330,d:"系统流畅运行",params:"基础型 · DDR5 16GB 单条",i:"🧠",c:3900150,id:"p03-02",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"金士顿 DDR5 16GB（5600）",sourceRow:30,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"展台M8（模拟）",t:"基础",p:300,d:"类比“书桌”讲运行空间",params:"基础型 · 8GB 运行空间（虚构）",i:"🧠",c:3900150,id:"p03-03",simulated:!0,extension:!1,tags:["ram"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"展台M8（模拟）",sourceRow:31,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"光威 DDR5 32GB 套装（16G×2）",t:"均衡",p:620,d:"同时跑模型与系统",params:"均衡型 · DDR5 32GB 双通道",i:"🧠",c:9133302,id:"p03-04",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"光威 DDR5 32GB 套装（16G×2）",sourceRow:32,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"金士顿 FURY DDR5 32GB 套装",t:"均衡",p:700,d:"较大模型常驻内存",params:"均衡型 · DDR5 32GB；6000MHz",i:"🧠",c:9133302,id:"p03-05",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"金士顿 FURY DDR5 32GB 套装",sourceRow:33,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"NVIDIA RTX 4060（8GB显存）",t:"均衡",p:2300,d:"轻量模型推理",params:"均衡型 · 8GB GDDR6 显存",i:"🧠",c:9133302,id:"p03-06",simulated:!1,extension:!1,tags:["vram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"NVIDIA RTX 4060（8GB显存）",sourceRow:34,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"展台M32（模拟）",t:"均衡",p:900,d:"讲容量与任务的关系",params:"均衡型 · 32GB 运行空间（虚构）",i:"🧠",c:9133302,id:"p03-07",simulated:!0,extension:!1,tags:["ram"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"展台M32（模拟）",sourceRow:35,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"芝奇 DDR5 64GB 套装（32G×2）",t:"增强",p:1500,d:"70亿参数模型常驻",params:"增强型 · DDR5 64GB 大容量",i:"🧠",c:15680580,id:"p03-08",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"芝奇 DDR5 64GB 套装（32G×2）",sourceRow:36,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"英睿达 DDR5 96GB 套装",t:"增强",p:2600,d:"更大模型与多任务",params:"增强型 · DDR5 96GB 超大容量",i:"🧠",c:15680580,id:"p03-09",simulated:!1,extension:!1,tags:["ram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"英睿达 DDR5 96GB 套装",sourceRow:37,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"NVIDIA RTX 4090（24GB显存）",t:"增强",p:16e3,d:"较大模型本地训练",params:"增强型 · 24GB GDDR6X 显存",i:"🧠",c:15680580,id:"p03-10",simulated:!1,extension:!1,tags:["vram"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"NVIDIA RTX 4090（24GB显存）",sourceRow:38,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"画境V16（模拟）",t:"增强",p:7500,d:"类比“灶台”讲显存",params:"增强型 · 16GB 显存（虚构）",i:"🧠",c:15680580,id:"p03-11",simulated:!0,extension:!1,tags:["vram"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"画境V16（模拟）",sourceRow:39,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"},{n:"展台M96（模拟）",t:"增强",p:9e3,d:"讨论容量上限与成本",params:"增强型 · 96GB 运行空间（虚构）",i:"🧠",c:15680580,id:"p03-12",simulated:!0,extension:!1,tags:["ram"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"展台M96（模拟）",sourceRow:40,sourceSheet:"部件选型表",sourceCategory:"运行空间",sourceType:"original-xlsx"}],输入设备:[{n:"罗技 C920 摄像头",t:"基础",p:400,d:"采集图像、拍题",params:"基础型 · 1080p 高清摄像头",i:"👁️",c:3900150,id:"p04-01",simulated:!1,extension:!1,tags:["camera"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"罗技 C920 摄像头（输入）",sourceRow:41,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"奥尼 A20 麦克风",t:"基础",p:350,d:"采集语音指令",params:"基础型 · 全向拾音麦克风",i:"🎙️",c:3900150,id:"p04-02",simulated:!1,extension:!1,tags:["mic"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"奥尼 A20 麦克风（输入）",sourceRow:42,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"ESP32 开发套件",t:"基础",p:120,d:"采集环境数据",params:"基础型 · 含温湿度/光线传感器",i:"📡",c:3900150,id:"p04-03",simulated:!1,extension:!1,tags:["sensor-kit","sensor"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"ESP32 开发套件（输入）",sourceRow:44,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"灵眸C1（模拟）",t:"基础",p:400,d:"讲采集环节的样例",params:"基础型 · 课堂简化摄像头（虚构）",i:"👁️",c:3900150,id:"p04-04",simulated:!0,extension:!1,tags:["camera"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"灵眸C1（模拟·输入）",sourceRow:46,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"海康威视 E14a 摄像头",t:"均衡",p:900,d:"清晰采集文字与图像",params:"均衡型 · 4K 高清摄像头",i:"👁️",c:9133302,id:"p04-05",simulated:!1,extension:!1,tags:["camera"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"海康威视 E14a 摄像头（输入）",sourceRow:47,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"安克 PowerConf S3",t:"均衡",p:600,d:"多人语音采集",params:"均衡型 · 会议级降噪拾音",i:"🎙️",c:9133302,id:"p04-06",simulated:!1,extension:!1,tags:["mic"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"安克 PowerConf S3（输入）",sourceRow:48,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"环听M6（模拟）",t:"均衡",p:1200,d:"讲多通道采集",params:"均衡型 · 六麦克风阵列（虚构）",i:"🎙️",c:9133302,id:"p04-07",simulated:!0,extension:!1,tags:["mic"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"环听M6（模拟·输入）",sourceRow:50,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"触知T1（模拟）",t:"基础",p:80,d:"感知按压或接触，不能识别图像。",params:"触碰输入；近距离触发；课堂设定，非实测",i:"👁️",c:3718648,tags:["sensor"],extension:!0,id:"p04-08",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"触知T1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"测距D2（模拟）",t:"基础",p:160,d:"检测前方距离，透明物体等情况需另测。",params:"单向测距；课堂避障演示；课堂设定，非实测",i:"👁️",c:3718648,tags:["sensor"],extension:!0,id:"p04-09",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"测距D2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"纸读S2（模拟）",t:"均衡",p:450,d:"获取纸面图像，识别文字还需模型。",params:"固定拍摄；依赖光照；课堂设定，非实测",i:"👁️",c:3718648,tags:["camera"],extension:!0,id:"p04-10",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"纸读S2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"视听A2（模拟）",t:"均衡",p:650,d:"同时采集图像与声音，不负责理解。",params:"摄像头＋麦克风；课堂设定，非实测",i:"👁️",c:3718648,tags:["camera","mic"],extension:!0,id:"p04-11",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"视听A2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"深视D4（模拟）",t:"增强",p:1800,d:"采集深度和图像，遮挡仍会影响结果。",params:"深度图＋彩色图；课堂设定，非实测",i:"👁️",c:3718648,tags:["camera","sensor"],extension:!0,id:"p04-12",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"深视D4（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"}],输出设备:[{n:"漫步者 M60 音箱",t:"基础",p:300,d:"播放讲解语音",params:"基础型 · 立体声有源音箱",i:"📢",c:3900150,id:"p05-01",simulated:!1,extension:!1,tags:["speaker"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"漫步者 M60 音箱（输出）",sourceRow:43,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"Arduino UNO 入门套件",t:"基础",p:200,d:"执行简单动作提示",params:"基础型 · 含舵机、LED、蜂鸣器",i:"💡",c:3900150,id:"p05-02",simulated:!1,extension:!1,tags:[],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Arduino UNO 入门套件（输出）",sourceRow:45,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"小米 27英寸 显示器",t:"均衡",p:800,d:"展示识别结果",params:"均衡型 · 1080p 显示输出",i:"🖥️",c:9133302,id:"p05-03",simulated:!1,extension:!1,tags:["display"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"小米 27英寸 显示器（输出）",sourceRow:49,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"极米 Play 5 投影仪",t:"增强",p:1600,d:"大画面展示结果",params:"增强型 · 便携式投影",i:"📽️",c:15680580,id:"p05-04",simulated:!1,extension:!1,tags:["display"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"极米 Play 5 投影仪（输出）",sourceRow:51,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"光幕P1（模拟）",t:"增强",p:1600,d:"讨论展示方式的成本",params:"增强型 · 投影光幕（虚构）",i:"📽️",c:15680580,id:"p05-05",simulated:!0,extension:!1,tags:["display"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"光幕P1（模拟·输出）",sourceRow:52,sourceSheet:"部件选型表",sourceCategory:"输入与输出设备",sourceType:"original-xlsx"},{n:"字屏T1（模拟）",t:"基础",p:100,d:"展示短文本，不适合复杂图表。",params:"小尺寸文字屏；课堂设定，非实测",i:"📢",c:3718648,tags:["display"],extension:!0,id:"p05-06",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"字屏T1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"提示L1（模拟）",t:"基础",p:40,d:"用灯光提示状态，不能展示完整答案。",params:"三色指示灯；课堂设定，非实测",i:"📢",c:3718648,tags:["indicator"],extension:!0,id:"p05-07",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"提示L1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"震动H1（模拟）",t:"基础",p:60,d:"提供触觉提醒，不输出语音。",params:"振动反馈；课堂设定，非实测",i:"📢",c:3718648,tags:["haptic"],extension:!0,id:"p05-08",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"震动H1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"声答S2（模拟）",t:"均衡",p:260,d:"概念演示“文字→本地TTS语音合成→扬声器播放”的输出链；不实际运行，不是可部署产品。",params:"本地语音合成（TTS）＋扬声器；课堂模拟本地语音输出概念组合，不实际运行，非实测",i:"📢",c:3718648,tags:["speaker","tts"],extension:!0,id:"p05-09",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"声答S2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"墨屏E2（模拟）",t:"均衡",p:550,d:"显示静态文字，动态画面受限。",params:"电子纸；低刷新率；课堂设定，非实测",i:"📢",c:3718648,tags:["display"],extension:!0,id:"p05-10",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"墨屏E2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"视听O3（模拟）",t:"均衡",p:900,d:"显示答案并播放声音，内容由软件生成。",params:"显示屏＋扬声器；课堂设定，非实测",i:"📢",c:3718648,tags:["display","speaker"],extension:!0,id:"p05-11",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"视听O3（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"触显T4（模拟）",t:"增强",p:1700,d:"显示图表并接收触控，不能替代摄像头。",params:"触控显示；需驱动适配；课堂设定，非实测",i:"📢",c:3718648,tags:["display"],extension:!0,id:"p05-12",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"触显T4（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"}],本地模型:[{n:"Qwen2.5-3B-Instruct",t:"基础",p:0,d:"轻量问答与讲解",params:"基础型 · 30亿参数；中文对话",i:"🧬",c:1096065,id:"p06-01",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Qwen2.5-3B-Instruct",sourceRow:53,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"Phi-3-mini（3.8B）",t:"基础",p:0,d:"资源受限设备也能跑",params:"基础型 · 38亿参数；端侧友好",i:"🧬",c:1096065,id:"p06-02",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Phi-3-mini（3.8B）",sourceRow:54,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"PaddleOCR",t:"基础",p:0,d:"识别图片中的文字",params:"基础型 · 开源文字识别模型",i:"🧬",c:1096065,id:"p06-03",simulated:!1,extension:!1,tags:["ocr"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"PaddleOCR",sourceRow:55,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"YOLOv8n",t:"基础",p:0,d:"识别物体与位置",params:"基础型 · 轻量目标检测模型",i:"🧬",c:1096065,id:"p06-04",simulated:!1,extension:!1,tags:["vision"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"YOLOv8n",sourceRow:56,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"文思L1（模拟）",t:"基础",p:0,d:"讲“模型是什么”",params:"基础型 · 课堂简化对话模型（虚构）",i:"🧬",c:1096065,id:"p06-05",simulated:!0,extension:!1,tags:["language"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"文思L1（模拟）",sourceRow:57,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"Qwen2.5-7B-Instruct",t:"均衡",p:0,d:"主力本地问答与讲解",params:"均衡型 · 70亿参数；中文对话",i:"🧬",c:1096065,id:"p06-06",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Qwen2.5-7B-Instruct",sourceRow:58,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"DeepSeek-R1-Distill-Qwen-7B",t:"均衡",p:0,d:"需要推理的问答",params:"均衡型 · 70亿参数；带推理链",i:"🧬",c:1096065,id:"p06-07",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"DeepSeek-R1-Distill-Qwen-7B",sourceRow:59,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"Llama 3.1 8B",t:"均衡",p:0,d:"多语言任务",params:"均衡型 · 80亿参数；多语言",i:"🧬",c:1096065,id:"p06-08",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Llama 3.1 8B",sourceRow:60,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"Gemma 2 9B",t:"均衡",p:0,d:"通用对话与写作",params:"均衡型 · 90亿参数；通用对话",i:"🧬",c:1096065,id:"p06-09",simulated:!1,extension:!1,tags:["language"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Gemma 2 9B",sourceRow:61,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"Whisper-large-v3",t:"均衡",p:0,d:"把语音转成文字",params:"均衡型 · 开源语音转文字模型",i:"🧬",c:1096065,id:"p06-10",simulated:!1,extension:!1,tags:["asr"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Whisper-large-v3",sourceRow:62,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"融感M3（模拟）",t:"增强",p:0,d:"讲图文音融合的能力",params:"增强型 · 多模态融合模型（虚构）",i:"🧬",c:1096065,id:"p06-11",simulated:!0,extension:!1,tags:["vision","language"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"融感M3（模拟）",sourceRow:63,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"},{n:"驭动C2（模拟）",t:"增强",p:0,d:"讲“从回答到行动”",params:"增强型 · 动作控制模型（虚构）",i:"🧬",c:1096065,id:"p06-12",simulated:!0,extension:!1,tags:["motion"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"驭动C2（模拟）",sourceRow:64,sourceSheet:"部件选型表",sourceCategory:"本地模型包",sourceType:"original-xlsx"}],行动部件:[{n:"Arduino 机械臂套件",t:"基础",p:500,d:"演示抓取与搬运",params:"基础型 · 4自由度；舵机驱动",i:"🦾",c:16096779,id:"p07-01",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Arduino 机械臂套件",sourceRow:65,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"树莓派 机器人底盘套件",t:"基础",p:800,d:"移动与避障演示",params:"基础型 · 两轮差速底盘",i:"🚗",c:16096779,id:"p07-02",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"树莓派 机器人底盘套件",sourceRow:66,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"大疆 OM 6 手机云台",t:"基础",p:600,d:"稳定拍摄讲解对象",params:"基础型 · 三轴增稳云台",i:"📷",c:16096779,id:"p07-03",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"大疆 OM 6 手机云台",sourceRow:67,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"云台G2（模拟）",t:"基础",p:600,d:"讲“感知—动作”配合",params:"基础型 · 双轴云台（虚构）",i:"📷",c:16096779,id:"p07-04",simulated:!0,extension:!1,tags:["actuator"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"云台G2（模拟）",sourceRow:68,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"Makeblock mBot2",t:"均衡",p:1200,d:"图形化编程与巡线",params:"均衡型 · 教育机器人小车",i:"🚗",c:16096779,id:"p07-05",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"Makeblock mBot2",sourceRow:69,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"LEGO Education SPIKE Prime",t:"均衡",p:3e3,d:"拼装结构与动作",params:"均衡型 · 教育机器人套装",i:"🧩",c:16096779,id:"p07-06",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"LEGO Education SPIKE Prime",sourceRow:70,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"大象机器人 myCobot 280",t:"均衡",p:5e3,d:"精准抓取与轨迹",params:"均衡型 · 6自由度桌面机械臂",i:"🦾",c:16096779,id:"p07-07",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"大象机器人 myCobot 280",sourceRow:71,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"巧书W1（模拟）",t:"均衡",p:4500,d:"讲“拿笔写字”的动作链",params:"均衡型 · 书写臂＋轨迹规划（虚构）",i:"✍️",c:16096779,id:"p07-08",simulated:!0,extension:!1,tags:["actuator"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"巧书W1（模拟）",sourceRow:72,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"宇树 Go2 Air（四足）",t:"增强",p:9997,d:"复杂地形移动",params:"增强型 · 四足移动；支持二次开发",i:"🐕",c:15680580,id:"p07-09",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"宇树 Go2 Air（四足）",sourceRow:73,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"巧臂A5（模拟）",t:"增强",p:12e3,d:"讨论精细操作难度",params:"增强型 · 五轴书写机械臂（虚构）",i:"🦾",c:15680580,id:"p07-10",simulated:!0,extension:!1,tags:["actuator"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"巧臂A5（模拟）",sourceRow:74,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"足迹F4（模拟）",t:"增强",p:9e3,d:"讨论移动与安全",params:"增强型 · 四足底盘（虚构）",i:"🐕",c:15680580,id:"p07-11",simulated:!0,extension:!1,tags:["actuator"],priceNote:"原表课堂设定价（模拟型号），未重新核价",sourceName:"足迹F4（模拟）",sourceRow:75,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"},{n:"宇树 G1 EDU（人形）",t:"增强",p:99e3,d:"人形动作与安全边界",params:"增强型 · 可配力控灵巧手；全身控制",i:"🤖",c:15680580,id:"p07-12",simulated:!1,extension:!1,tags:["actuator"],priceNote:"沿用原表参考价，未重新核价，不作采购依据",sourceName:"宇树 G1 EDU（人形）",sourceRow:76,sourceSheet:"部件选型表",sourceCategory:"行动部件",sourceType:"original-xlsx"}],供电与安全:[{n:"稳供P1（模拟）",t:"基础",p:90,d:"固定供电，移动范围受电缆限制。",params:"教学低压电源；接口待核对；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-01",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"稳供P1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"短航B1（模拟）",t:"基础",p:120,d:"适合短时移动演示，续航需实测。",params:"20Wh；输出功率待核对；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-02",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"短航B1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"静冷F1（模拟）",t:"基础",p:60,d:"辅助散热，不能代替供电。",params:"风冷散热附件；课堂设定，非实测",i:"🔋",c:3718648,tags:["cool"],extension:!0,id:"p08-03",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"静冷F1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"急停E1（模拟）",t:"基础",p:70,d:"异常时人工切断动作，不能代替供电。",params:"独立急停附件；课堂设定，非实测",i:"🔋",c:3718648,tags:["stop"],extension:!0,id:"p08-04",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"急停E1（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"均航B2（模拟）",t:"均衡",p:260,d:"容量增加也会增加重量。",params:"50Wh；机载电池；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-05",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"均航B2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"稳压P2（模拟）",t:"均衡",p:220,d:"稳定输出，仍需核对负载与接口。",params:"稳压供电；桌面使用；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-06",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"稳压P2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"温控F2（模拟）",t:"均衡",p:200,d:"按温度调节散热，不提供能源。",params:"温度反馈＋散热；课堂设定，非实测",i:"🔋",c:3718648,tags:["cool"],extension:!0,id:"p08-07",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"温控F2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"安航S2（模拟）",t:"均衡",p:450,d:"兼顾供电和急停，仍需安全测试。",params:"40Wh＋急停；课堂设定，非实测",i:"🔋",c:3718648,tags:["power","stop"],extension:!0,id:"p08-08",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"安航S2（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"长航B3（模拟）",t:"增强",p:750,d:"提高储能，重量与充电时间也增加。",params:"100Wh；续航不直接保证；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-09",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"长航B3（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"轻航B4（模拟）",t:"增强",p:900,d:"以更高成本控制携带重量。",params:"60Wh；轻量化课堂设定；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-10",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"轻航B4（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"双路P3（模拟）",t:"增强",p:1100,d:"备用电源切换不代表完全不会中断。",params:"双路供电；切换需实测；课堂设定，非实测",i:"🔋",c:3718648,tags:["power"],extension:!0,id:"p08-11",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"双路P3（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"},{n:"守护S3（模拟）",t:"增强",p:1300,d:"集成供电、温控与急停，仍不能消除风险。",params:"80Wh＋温控＋急停；课堂设定，非实测",i:"🔋",c:3718648,tags:["power","cool","stop"],extension:!0,id:"p08-12",simulated:!0,priceNote:"课堂设定价，非市场报价",sourceName:"守护S3（模拟）",sourceRow:null,sourceSheet:null,sourceCategory:null,sourceType:"classroom-extension"}]},Os=["计算模块","长期存储","运行空间","输入设备","输出设备","本地模型"],_g={camera:"摄像头",ocr:"文字识别",vision:"图像理解",mic:"麦克风",asr:"语音识别",language:"语言模型",tts:"语音合成",display:"显示器",speaker:"扬声器",sensor:"环境传感器",motion:"动作规划",actuator:"执行机构",stop:"急停/人工接管",ram:"主内存",vram:"显存"},sl={camera:"输入设备",mic:"输入设备",sensor:"输入设备",ocr:"本地模型",vision:"本地模型",asr:"本地模型",language:"本地模型",motion:"本地模型",tts:"输出设备",display:"输出设备",speaker:"输出设备",actuator:"行动部件",stop:"供电与安全"},Ra=i=>_g[i]||i,Qt=(i,e)=>!!i[e]?.length,Hi=(i,e,t)=>!!i[e]?.includes(t),vg=i=>Object.entries(i).flatMap(([e,t])=>t.map(n=>({category:e,part:n}))),jn=(i,e)=>Object.keys(i).flatMap(t=>[...new Set(e[t]||[])].flatMap(n=>{const s=i[t].find(r=>r.id===n);return s?[{category:t,part:s}]:[]})),rl=(i,e)=>new Set(jn(i,e).flatMap(t=>t.part.tags)),qa=i=>Object.fromEntries(Object.entries(i).map(([e,t])=>[e,[...t]])),xg=(i,e)=>({selected:qa(e),items:jn(i,e).map(t=>({category:t.category,...t.part}))});function Mg(i,e){if(!i||typeof i!="object"||Array.isArray(i))throw new Error("选型格式无效");const t={};let n=0;for(const[s,r]of Object.entries(i)){const a=typeof r=="string"?[r]:Array.isArray(r)?r:[r];for(const o of a){if(typeof o!="string"||!e[s]?.some(l=>l.id===o)||t[s]?.includes(o)){n++;continue}(t[s]||=[]).push(o)}}return{selected:t,skipped:n}}const Ji=i=>[...i.tags.some(e=>["ram","shared-memory","unified-memory"].includes(e))?["ram"]:[],...i.tags.includes("vram")?["vram"]:[]];function yg(i,e){const t=[];for(const[s,r]of Object.entries(e)){const a=s==="本地模型"?3:s==="运行空间"?2:1;r.length>a&&t.push(`${s}最多 ${a} 项，请移除多余选项。`),(new Set(r).size!==r.length||r.some(o=>!i[s]?.some(l=>l.id===o)))&&t.push(`${s}含重复或失效型号。`)}const n=jn(i,e).filter(s=>s.category==="运行空间");for(const s of["ram","vram"])n.filter(r=>Ji(r.part).includes(s)).length>1&&t.push(`运行空间的${Ra(s)}最多 1 项。`);return n.some(s=>!Ji(s.part).length)&&t.push("运行空间缺少内存/显存类别标签，需核对目录。"),Js(jn(i,e)).enhanced>2&&t.push("增强型全方案最多 2 项，请移除或替换。"),t}function al(i,e,t){const n=qa(i),s=(n[e]||[]).filter(r=>r!==t);return s.length?n[e]=s:delete n[e],n}function _c(i,e,t){const n=vg(i).find(h=>h.part.id===t),s=h=>({selected:e,error:h,removed:[],action:"blocked"});if(!n)return s("目录中没有该型号。");const{category:r,part:a}=n;if(Hi(e,r,t))return{selected:al(e,r,t),removed:[t],action:"removed"};const o=e[r]||[];let l=[];if(r==="本地模型"){if(o.length>=3)return s("本地模型最多 3 项，请先移除不需要的模型，再加入新模型。");l=o}else if(r==="运行空间"){const h=Ji(a);if(!h.length)return s("该运行空间缺少内存/显存标签，请核对目录。");if(l=o.filter(p=>{const m=i[r].find(v=>v.id===p);return m&&!Ji(m).some(v=>h.includes(v))}),l.length>=2)return s("运行空间最多 2 项，内存与显存各至多 1 项。")}const c={...qa(e),[r]:[...l,t]};if(Js(jn(i,c)).enhanced>2)return s("增强型全方案最多 2 项，请先替换或移除一项。");const d=o.filter(h=>!l.includes(h));return{selected:c,removed:d,action:d.length?"replaced":"added"}}function Js(i){const e=i.some(s=>s.category==="计算模块"&&s.part.n.includes("RTX 4060"))&&i.some(s=>s.category==="运行空间"&&s.part.tags.includes("vram")&&s.part.n.includes("RTX 4060")),t=e?i.filter(s=>s.category==="运行空间"&&s.part.tags.includes("vram")&&s.part.n.includes("RTX 4060")).map(s=>s.part.id):[],n=i.filter(s=>!t.includes(s.part.id));return{price:n.reduce((s,r)=>s+r.part.p,0),simulated:n.filter(s=>s.part.simulated).reduce((s,r)=>s+r.part.p,0),enhanced:i.filter(s=>s.part.t==="增强").length,duplicate:e,unchargedIds:t}}function Bs(i){const e=(s,r=!1)=>r?{label:s,detail:"显示器，或语音合成 + 扬声器",category:"输出设备",textOrSpeech:!0}:{label:s,detail:"文字或声音输出",category:"输出设备",tags:["display","speaker"]},t=(s,r,a)=>[{label:s,detail:"摄像头",category:"输入设备",tags:["camera"]},{label:r,detail:"模型组合：OCR 或图像理解",category:"本地模型",tags:["ocr","vision"]},{label:"运行与思考",detail:"计算模块 + 语言模型",category:"计算模块",tags:["language"]},e(a,!0)];return{question:t("拍下题目","识别文字","讲解并输出"),homework:t("采集作业","读取答案","批改并反馈"),organize:[{label:"收集资料",detail:"输入设备或已有文件",category:"输入设备"},{label:"保存资料",detail:"长期存储",category:"长期存储"},{label:"检索与整理",detail:"计算模块 + 语言模型",category:"计算模块",tags:["language"]},e("呈现结果")],voice:[{label:"听到声音",detail:"麦克风",category:"输入设备",tags:["mic"]},{label:"语音转文字",detail:"模型组合：语音识别",category:"本地模型",tags:["asr"]},{label:"理解并生成回答",detail:"模型组合：语言模型",category:"本地模型",tags:["language"]},{label:"说出回答",detail:"本地语音合成 + 扬声器",category:"输出设备",tagGroups:[["tts"],["speaker"]]}],vision:[{label:"采集图像",detail:"摄像头",category:"输入设备",tags:["camera"]},{label:"识别内容",detail:"图像理解或 OCR",category:"本地模型",tags:["vision","ocr"]},{label:"完成计算",detail:"计算模块",category:"计算模块"},e("显示结果")],action:[{label:"感知环境",detail:"传感器",category:"输入设备",tags:["sensor"]},{label:"理解与规划",detail:"本地动作规划或语言模型",category:"本地模型",tags:["motion","language"]},{label:"执行动作",detail:"电机、机械臂或轮组",category:"行动部件",tags:["actuator"]},{label:"急停/人工接管",detail:"仅检查 stop 标签；动作反馈仍需实测",category:"供电与安全",tags:["stop"]}],sense:[{label:"采集环境量",detail:"传感器",category:"输入设备",tags:["sensor"]},{label:"处理数据",detail:"计算模块",category:"计算模块"},{label:"判断状态",detail:"本地模型或规则",category:"本地模型"},e("输出提醒")]}[i]||[]}function $a(i,e){const t=[...i.tagGroups||(i.tags?[i.tags]:[])];return i.textOrSpeech&&!e.has("display")&&t.push(["tts"],["speaker"]),t.filter(n=>!n.some(s=>e.has(s)))}function ol(i,e,t){return(!i.category||Qt(e,i.category))&&!$a(i,t).length}function cl(i,e,t){const n=[];i.category&&!Qt(e,i.category)&&n.push(`缺少${i.category}${i.category==="本地模型"?"（可组合最多 3 项）":""}`);const s=$a(i,t),r=s.filter(o=>o.every(l=>sl[l]==="本地模型"));r.length&&n.push(`模型组合还需：${r.map(o=>o.map(Ra).join("或")).join("、")}`);const a=s.filter(o=>!r.includes(o));return a.length&&n.push(`还需${a.map(o=>o.map(Ra).join("或")).join("、")}`),s.some(o=>o.includes("tts"))&&n.push("语音合成可由本地模型或含 tts 的输出组合提供"),i.textOrSpeech&&s.length&&n.push("也可改用显示器输出"),n.join("；")}function Sg(i,e,t){return i.category&&!Qt(e,i.category)?i.category:$a(i,t).flat().map(n=>sl[n]).find(Boolean)||i.category||"configuration"}function vc(i,e,t,n=null,s=!0){const r=jn(i,e),a=rl(i,e),o=Bs(t),l=o.filter(g=>!ol(g,e,a)),c=Os.filter(g=>!r.some(u=>u.category===g)),d=Js(r),h=yg(i,e);c.length&&h.push(`基础模块还缺：${c.join("、")}`);const p=r.filter(g=>g.category==="运行空间"),m=p.some(g=>Ji(g.part).includes("ram"));p.length&&!m&&h.push("运行空间需包含主内存或共享内存，只有显存不能替代主内存。"),!s||n!==null&&(!Number.isFinite(n)||n<0||n>1e9)?h.push("预算格式无效，请输入非负数字，或留空。"):n!==null&&d.price>n&&h.push(`超出预算 ¥${d.price-n}，请替换或移除部件。`),o.length||h.push("先确定一个有效的第一优先功能。");const v=o.length>0&&l.length===0,x=c.length===0&&m;return{id:t,chainCovered:v,baseComplete:x,passed:v&&h.length===0,missingSteps:l,missingCore:c,blockers:h,accounting:d,missing:[...l.map(g=>`${g.label}：${cl(g,e,a)}`),...h]}}function zi(i,e){return i.passed&&!!(e?.passed&&e.id===i.id)}const Ds={计算模块:"compute",长期存储:"memory",运行空间:"memory",输入设备:"perception",输出设备:"output",本地模型:"cognition",行动部件:"action",供电与安全:"power"},ke=i=>String(i).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),Jt=i=>`¥${i.toLocaleString("zh-CN",{maximumFractionDigits:2})}`,xc="ai-classmate-selection-v3",Eg=["ai-classmate-selection-v2","ai-classmate-selection-v1"],Mc=Object.assign({"./catalog.json":gg}),Gi=[{id:"question",label:"📚 拍题讲解",cat:["计算模块","输入设备","本地模型"],summary:"拍下题目，识别内容并生成讲解。"},{id:"homework",label:"✍️ 作业批改",cat:["计算模块","输入设备","本地模型"],summary:"读取作业，给出批改意见并输出结果。"},{id:"organize",label:"📋 资料整理",cat:["计算模块","长期存储"],summary:"保存资料、检索内容并整理成结构化信息。"},{id:"voice",label:"🎤 语音交互",cat:["计算模块","输入设备","输出设备","本地模型"],summary:"听懂语音、组织回答，再用声音表达。"},{id:"vision",label:"👁️ 图像识别",cat:["计算模块","输入设备","本地模型"],summary:"识别图像中的文字、物体或场景。"},{id:"action",label:"🦾 动作控制",cat:["计算模块","行动部件","本地模型"],summary:"根据判断规划动作，并与环境交互。"},{id:"sense",label:"📡 环境感知",cat:["输入设备","计算模块"],summary:"采集温度、距离、光线等环境信息。"}],Tg=i=>Gi.find(e=>e.id===i)?.label||i,bn=i=>Tg(i).replace(/^\S+\s/,""),bg=["行动部件","供电与安全"];function Ag(i){const e=document.querySelector(".left-panel"),t=document.querySelector(".right-panel"),n=document.querySelector(".stage-panel"),s=document.createElement("details");for(s.className="model-inspector",s.innerHTML='<summary>结构观察与课堂探究 <span>展开</span></summary><div class="model-inspector-body"></div>',s.querySelector(".model-inspector-body").append(document.querySelector("#module-list"));t.firstChild;)s.querySelector(".model-inspector-body").append(t.firstChild);n.append(s);let r=Object.fromEntries(Object.keys(Ds).map(_=>[_,[]]));const a="catalog.json · 唯一型号目录";let o="型号目录未加载，暂不可选型。请确认 src/catalog.json 已到位并重新构建。";if(Mc["./catalog.json"])try{const _=Mc["./catalog.json"];if(!_||Object.keys(_).length!==8||Object.keys(Ds).some(y=>!Array.isArray(_[y])||_[y].length!==12))throw new Error("类别或条目数量不符");const f=new Set;for(const y of Object.values(_))for(const L of y){if(!L||["id","n","params","d","t"].some(z=>typeof L[z]!="string")||typeof L.p!="number"||!Number.isFinite(L.p)||L.p<0||typeof L.simulated!="boolean"||typeof L.extension!="boolean"||!Array.isArray(L.tags)||L.tags.some(z=>typeof z!="string")||f.has(L.id))throw new Error("字段或 ID 不符");f.add(L.id)}r=_,o=""}catch{o="catalog.json 格式未通过检查，暂不可选型。需提供 8 类各 12 项、唯一 ID、完整字段及 tags。"}const l=Object.keys(Ds),c=l.flatMap(_=>r[_].map(f=>({category:_,part:f}))),d=_=>c.find(f=>f.part.id===_);let h="全部",p="",m="all",v={},x=[],g=null,u=!0,A="",b="",E=[],D="",R="",P="",U=!1,T=!1,S=!1,C=null,B=null;const k=_=>{const f=document.querySelector("#selection-status");f&&(f.textContent=_)},$=()=>jn(r,v),q=()=>rl(r,v),X=()=>vc(r,v,b,g,u),Z=()=>U||!!(D.trim()&&R.trim()),W=()=>({version:3,savedAt:new Date().toISOString(),name:A,primaryFeature:b,features:E,budget:g,reason:D,testPlan:R,risk:P,paperRecorded:U,...xg(r,v),source:a,validation:X(),completion:zi(X(),B)&&Z(),priceNote:"课堂参考价，未重新核价；真实型号标记不代表已核实性能或可采购。"}),se=(_=!0)=>{T=!0,_&&(S=!1,C=null,B=null,Ye()),k(_?"有未保存的调整；配置变化后需要重新测试。":"课堂记录已调整，记得保存；原配置检查仍有效。"),ue()},ue=()=>{const _=Os.filter(he=>Qt(v,he)).length,f=!!b,y=X(),L=f&&y.baseComplete&&y.blockers.length===0,z=L&&zi(y,B),H=z&&Z(),ie=[f,L,z,H];document.querySelectorAll("[data-journey-step]").forEach(he=>{const Me=Number(he.dataset.journeyStep),J=ie[Me-1];he.classList.toggle("is-done",!!J),he.classList.toggle("is-current",!J&&ie.slice(0,Me-1).every(Boolean))});const ee=z?"核心任务概念检查通过":B?"核心任务待调整":S?"核心任务仍需测试":"尚未测试";document.querySelector("#journey-summary").textContent=`${b?`核心任务：${bn(b)}`:"尚未确定核心任务"} · 核心模块 ${_}/6 · ${ee}`,document.querySelectorAll("[data-journey-step]").forEach(he=>{he.setAttribute("aria-current",he.classList.contains("is-current")?"step":"false")})};e.innerHTML=`<div class="selection-panel-title"><span>02 / 选型</span><h1>部件库 <small>${c.length} 型号</small></h1><p class="panel-subtitle">先确定任务，再为任务补齐信息流。</p></div><label class="search-label">搜索全部型号<input id="part-search" type="search" placeholder="型号、参数或用途" autocomplete="off"></label><div class="catalog-filters" role="group" aria-label="型号筛选"><button data-filter="all" aria-pressed="true">全部</button><button data-filter="real" aria-pressed="false">真实型号</button><button data-filter="simulated" aria-pressed="false">课堂模拟</button></div><nav id="category-nav" aria-label="部件类别"></nav><div class="library-meta"><span id="result-count"></span><button id="clear-search" type="button">重置筛选</button></div><div id="part-results" class="part-results"></div><div class="compare-tray"><span id="compare-count">选择 2–3 项对比</span><button id="open-compare" disabled>对比</button><button id="clear-compare">清空</button></div><p class="catalog-note">模型最多 3 项；运行空间最多 2 项（内存/显存各 1 项）；其余每类 1 项。增强型全方案最多 2 项。价格为教学参考。</p>`,t.innerHTML=`<div class="selection-panel-title"><span>01 / 需求</span><h2>我的 AI 同学</h2><p class="panel-subtitle">先回答“它要做什么”，再决定“需要什么”。</p></div><div class="config-scroll"><label class="name-label" for="selection-name">AI同学名称 <span>选填</span></label><input id="selection-name" type="text" maxlength="20" placeholder="给你的AI同学起个名字"><div id="next-guidance" class="next-guidance start" role="status" aria-live="polite"></div><section class="mission-block" id="mission-block"><div class="section-heading"><h3>第一优先功能</h3><span>只能选一个</span></div><p class="mission-hint" id="mission-hint">先选一个，网页会自动生成任务链。</p><div id="primary-options" class="primary-options" role="radiogroup" aria-label="第一优先功能"></div><div class="section-heading extension-heading"><h3>扩展能力</h3><span id="extension-caption">可多选</span></div><div id="feature-options" class="feature-options" role="group" aria-label="扩展能力"></div><p class="mission-hint">扩展用于讨论或尝试，可回调选型，不要求全部实现；输入设备仍单选，完成判定只看第一优先功能。</p></section><label class="budget-label" for="selection-budget">预算上限 <span>元 · 可选</span></label><div class="budget-presets" role="group" aria-label="预算预设"><button data-budget="5000">¥5,000</button><button data-budget="8000">¥8,000</button><button data-budget="12000">¥12,000</button><button data-budget="clear">不设上限</button></div><input id="selection-budget" type="number" min="0" max="1000000000" step="any" placeholder="未设置 · 可选"><section class="task-chain" id="task-chain-section"><div class="section-heading"><h3>任务链</h3><span id="task-chain-caption">先选一个核心任务</span></div><div id="task-chain-content"></div></section><div class="budget-summary" id="budget-summary"></div><section><div class="section-heading"><h3>配置清单</h3><span id="selected-count"></span></div><div id="configuration"></div></section><section class="test-bench" id="test-bench"><div class="section-heading"><h3>03 / 测试台</h3><span>概念模拟，不运行真实模型</span></div><label for="test-scenario">选择测试任务</label><select id="test-scenario"></select><button id="run-test" class="test-button">运行一次流程测试</button><div id="test-result" class="test-result" role="status" aria-live="polite">完成选型后，点击测试查看信息流是否连通。</div></section><label class="paper-record"><input id="paper-recorded" type="checkbox">取舍、测试计划和风险已记在纸面任务单，不必重复填写</label><label class="reason-label" id="selection-reason-block" for="selection-reason">04 / 我的取舍<textarea id="selection-reason" rows="3" maxlength="4000" placeholder="我优先投入……，因为……；仍需……"></textarea></label><label class="test-plan-label" for="test-plan">我的测试计划<textarea id="test-plan" rows="3" maxlength="1000" placeholder="我用________任务测试；观察________；如果失败，问题可能在________。"></textarea></label><label class="risk-label" for="risk-select">我认为需要特别注意的风险<select id="risk-select"><option value="">请选择一项</option><option>收集过多声音或图像</option><option>AI给出错误答案</option><option>误解人的意图</option><option>自动行动造成危险</option><option>人类过度依赖AI</option></select></label><section class="checks"><div class="section-heading"><h3>检查与调整</h3><button id="run-checks">重新检查</button></div><div id="rule-results"></div><p>检查依据是部件标签与任务链，不代表真实性能、准确率或兼容性。</p></section><details class="data-source"><summary>数据来源与边界</summary><p>${ke(a)}</p><p>${ke(o||"参数按原文展示，不推算模型运行能力或硬件兼容性。")}</p></details></div><div class="save-actions"><button id="save-selection">保存</button><button id="restore-selection">恢复</button><button id="export-report">导出课堂报告</button><button id="export-selection">导出 JSON</button></div><p id="selection-status" role="status" aria-live="polite">${ke(o||"配置保存在本机浏览器，不会上传。")}</p>`;const ve=document.createElement("p");ve.className="concept-note",ve.id="concept-note",ve.textContent="选型仅作概念映射，不改变机器人几何；外观不代表真实安装位置。",n.querySelector(".stage-head").after(ve);const Ie=document.createElement("section");Ie.className="assembly-state",Ie.setAttribute("aria-label","示意装配状态"),Ie.innerHTML='<div class="assembly-state-head"><strong id="assembly-count">核心选型 0 / 6 · 扩展 0 / 2</strong><span>概念示意 · 非实际结构</span></div><p id="assembly-change" role="status" aria-live="polite">尚未选型，机器人展示完整示意结构。</p><div id="assembly-selection"></div>',n.querySelector(".canvas-wrap").after(Ie);function We(_){document.querySelector("#assembly-change").textContent=_}const $e=document.createElement("dialog");$e.className="comparison-dialog",$e.setAttribute("aria-labelledby","compare-title"),$e.innerHTML='<header><div><span>并排阅读原始数据</span><h2 id="compare-title">型号对比</h2></div><button id="close-compare" aria-label="关闭对比">关闭 ×</button></header><div id="comparison-content"></div>',document.body.append($e);function Ve(){document.querySelector("#primary-options").innerHTML=Gi.map(y=>`<label class="primary-option ${b===y.id?"is-selected":""}"><input type="radio" name="primary-feature" value="${y.id}" ${b===y.id?"checked":""}><span><strong>${ke(bn(y.id))}</strong><small>${ke(y.summary)}</small></span></label>`).join("");const _=document.querySelector("#mission-hint");_&&(_.textContent=b?`已确定“${bn(b)}”，下面的任务链会据此更新。`:"先选一个，网页会自动生成任务链。");const f=document.querySelector("#extension-caption");f&&(f.textContent=E.length?`已选 ${E.length} 项`:"可多选"),document.querySelector("#feature-options").innerHTML=b?Gi.filter(y=>y.id!==b).map(y=>`<label><input type="checkbox" value="${y.id}" ${E.includes(y.id)?"checked":""}><span>${ke(bn(y.id))}</span></label>`).join(""):'<p class="empty-inline">先选一个第一优先功能，再添加扩展能力。</p>'}function Y(_){i(Ds[_]);const f=_==="本地模型"?"认知软件；头部与核心仅作概念关联":_==="长期存储"||_==="运行空间"?"腹部记忆区域（两类分别选型）":"对应结构区域";ve.textContent=`${_} → ${f}；仅概念高亮，不代表安装位置或兼容性。`}function j(){document.querySelector("#category-nav").innerHTML=["全部",...l].map(y=>`<button data-category="${ke(y)}" aria-pressed="${h===y}">${ke(y)}<small>${y==="全部"?c.length:r[y].length}</small></button>`).join(""),document.querySelectorAll("[data-filter]").forEach(y=>{y.setAttribute("aria-pressed",String(y.dataset.filter===m))});const _=p.toLowerCase().split(/\s+/).filter(Boolean),f=c.filter(y=>{const L=m==="all"||(m==="simulated"?y.part.simulated:!y.part.simulated),z=`${y.category} ${y.part.id} ${y.part.n} ${y.part.params} ${y.part.d} ${y.part.t}`.toLowerCase();return L&&(h==="全部"||y.category===h)&&_.every(H=>z.includes(H))});document.querySelector("#result-count").textContent=`${h} · ${f.length} 项`,document.querySelector("#part-results").innerHTML=f.length?f.map(({category:y,part:L})=>`<article class="part-row ${Hi(v,y,L.id)?"is-selected":""}"><div class="part-tags"><span>${ke(y)} · ${ke(L.t)}</span><span class="${L.simulated?"simulated":""}">${L.simulated?"课堂模拟":"真实型号"}${L.extension?" · 扩展":""}</span></div><h3>${ke(L.n)}</h3><p class="part-params">${ke(L.params)}</p><p class="part-purpose">${ke(L.d)}</p><div class="part-actions"><strong>${Jt(L.p)}</strong><label><input type="checkbox" data-compare="${ke(L.id)}" ${x.includes(L.id)?"checked":""}>对比</label><button data-select="${ke(L.id)}" aria-pressed="${Hi(v,y,L.id)}">${pe(y,L.id)}</button></div></article>`).join(""):`<div class="empty-results" role="status">${ke(o||"没有匹配型号，请修改关键词或重置筛选。")}</div>`,document.querySelector("#compare-count").textContent=x.length?`已加入 ${x.length} / 3 项`:"选择 2–3 项对比",document.querySelector("#open-compare").disabled=x.length<2}function pe(_,f){return Hi(v,_,f)?"移除此项":_==="本地模型"?`加入模型组合 (${v[_]?.length||0}/3)`:_==="运行空间"?_c(r,v,f).action==="replaced"?"替换同类运行空间":"加入运行空间":Qt(v,_)?"替换同类":"加入配置"}function be(_=$()){return Js(_)}function xe(_,f){return ol(_,v,f)}function He(_,f){return cl(_,v,f)}function vt(){if(!b)return{tone:"start",title:"从任务开始",detail:"先选一个第一优先功能，网页会把它拆成信息处理链。",target:"mission-block"};const _=q(),f=Bs(b).find(z=>!xe(z,_));if(f){const z=Sg(f,v,_);return{tone:"next",title:`下一步：补齐“${f.label}”`,detail:He(f,_)||"回到部件库选择能覆盖这一步的部件。",target:z}}const y=Os.filter(z=>!Qt(v,z));if(y.length)return{tone:"next",title:"再补齐基础模块",detail:`任务标签已覆盖，继续查看“${y[0]}”，完成基础配置。`,target:y[0]};const L=X();return L.blockers.length?{tone:"next",title:"先处理配置限制",detail:L.blockers.join("；"),target:"rule-results"}:zi(L,B)?Z()?{tone:"done",title:"课堂方案已形成",detail:"基础配置与核心任务标签检查通过，可保存或导出；仍不代表真实模型、硬件或动作反馈已经验证。",target:"rule-results"}:{tone:"reflect",title:"下一步：说明你的取舍",detail:"取舍、测试计划和风险可记录在纸面任务单；勾选已记录即可，不必重复输入。",target:"selection-reason-block"}:{tone:"test",title:"下一步：测试第一优先功能",detail:"检查标签信息链和基础配置；扩展任务通过不能替代核心任务测试。",target:"test-bench"}}function w(){const _=vt(),f=document.querySelector("#next-guidance");f&&(f.className=`next-guidance ${_.tone}`,f.innerHTML=`<div><span class="guidance-kicker">课堂提示</span><strong>${ke(_.title)}</strong><p>${ke(_.detail)}</p></div><button type="button" data-guide-target="${ke(_.target)}">前往</button>`)}function et(){const _=b,f=_?Bs(_):[],y=q(),L=f.filter(z=>xe(z,y)).length;document.querySelector("#task-chain-caption").textContent=_?`${bn(_)} · ${L}/${f.length} 步已覆盖`:"先选一个核心任务",document.querySelector("#task-chain-content").innerHTML=f.length?`<div class="chain-flow">${f.map((z,H)=>{const ie=xe(z,y),ee=ie?"已覆盖":He(z,y)||"待补充";return`<div class="chain-step ${ie?"is-ready":"is-missing"}"><span>${H+1}</span><strong>${ke(z.label)}</strong><small>${ke(z.detail)}</small><em>${ke(ee)}</em></div>${H<f.length-1?'<i class="chain-arrow">→</i>':""}`}).join("")}</div>`:'<div class="empty-inline">确定第一优先功能后，网页会把任务拆成一条信息处理链。</div>',w()}function Pe(){const _=X(),f=[..._.missing],y=[],L=[];return f.length||f.push(zi(_,B)?"基础配置与核心任务概念检查通过；不代表真实系统验证。":"信息链已覆盖且基础配置完整，请测试第一优先功能。"),Qt(v,"行动部件")&&b!=="action"&&y.push("已选行动部件，但核心任务不是动作控制：请说明它是否值得投入。"),Qt(v,"供电与安全")&&y.push("供电与安全需要继续说明电源、散热、急停或人工接管措施。"),!U&&!R.trim()&&y.push("测试计划可记在纸面任务单或此处：说明测试任务、观察结果和失败位置。"),!U&&!D.trim()&&y.push("取舍可记在纸面任务单或此处：说明优先投入什么，以及放弃了什么。"),y.length||y.push(U?"已确认在纸面任务单记录取舍、测试计划与风险。":"已填写取舍与测试计划，请同时记录风险与应对。"),E.length&&L.push("扩展能力仅作讨论或尝试，不要求同时全部实现；需要时回调选型，并重新检查核心任务。"),b==="action"&&L.push("急停/人工接管标签只覆盖安全退出措施，不证明动作反馈、闭环控制或真实执行已经验证。"),L.push(U?"风险与应对已记在纸面任务单；课堂展示时说明。":P?`已记录风险：${P}。请补一句降低风险的方法。`:"请选择一个你认为需要特别注意的风险。"),L.push("真实系统还需要核验接口、功耗、驱动、模型许可、准确性和安全性。"),L.push("处理声音或图像前应先获得授权，避免收集无关个人信息。"),[{title:"必须补齐",tone:"must",rows:f},{title:"需要说明",tone:"explain",rows:y},{title:"课堂讨论",tone:"discuss",rows:L}]}function Se(){const _=be(),f=Pe();document.querySelector("#rule-results").innerHTML=f.map(y=>`<section class="check-group ${y.tone}"><div class="check-group-title"><h4>${y.title}</h4><span>${y.rows.length}项</span></div><ul>${y.rows.map(L=>`<li>${ke(L)}</li>`).join("")}</ul></section>`).join(""),document.querySelector("#budget-summary").innerHTML=`<div><span>课堂参考总价 · 含模拟 ${Jt(_.simulated)}</span><strong>${Jt(_.price)}</strong></div><span class="${!u||g!==null&&_.price>g?"over-budget":""}">${u?g===null?"未设上限":_.price>g?`超出 ${Jt(_.price-g)}`:`剩余 ${Jt(g-_.price)}`:"预算无效"}</span>`,ue(),w()}function ge(){const _=[...new Set([b,...E].filter(Boolean))],f=document.querySelector("#test-scenario");f.innerHTML=_.length?_.map(y=>`<option value="${y}" ${y===(C?.id||b)?"selected":""}>${ke(bn(y))}</option>`).join(""):'<option value="">请先选择功能</option>'}function Ye(){const _=document.querySelector("#test-result");if(!C){_.className="test-result",_.textContent="完成选型后，点击测试查看信息流是否连通。";return}const f=Bs(C.id);_.className=`test-result ${C.passed?"passed":"failed"}`,_.innerHTML=`<strong>${C.passed?"概念检查通过（非真实运行）":C.chainCovered?"信息链已覆盖，配置仍待补齐":"信息链尚未覆盖"}</strong><p>${C.passed?`${C.id===b?"核心任务":"扩展任务"}标签与基础配置检查通过；取舍、测试计划和风险可记在纸面任务单。`:`未通过：${ke(C.missing.join("；"))}`}</p><p>信息链：${C.chainCovered?"已覆盖":"未覆盖"} · 基础模块：${C.baseComplete?"完整":"未完整"}；不验证真实性能、兼容性或动作反馈。</p><div class="test-trace">${f.map((y,L)=>`<span class="${xe(y,q())?"ok":"fail"}">${L+1}. ${ke(y.label)}</span>`).join("")}</div>`}function de(){const _=$(),f=be(_),y=Os.filter(z=>Qt(v,z)).length,L=bg.filter(z=>Qt(v,z)).length;document.querySelector("#assembly-count").textContent=`核心选型 ${y} / 6 · 扩展 ${L} / 2`,document.querySelector("#assembly-selection").innerHTML=l.map(z=>{const H=_.filter(ie=>ie.category===z).map(ie=>ie.part.n).join(" + ");return`<span data-assembly-category="${ke(z)}" data-selected="${!!H}" title="${ke(H||"未选")}">${H?"✓":"○"} ${ke(z)}：${ke(H||"未选")}</span>`}).join(""),document.querySelector("#selected-count").textContent=`核心 ${y}/6 · 扩展 ${L}/2 · 已选 ${_.length} 项 · 增强 ${f.enhanced}/2`,document.querySelector("#configuration").innerHTML=l.map(z=>{const H=_.filter(ie=>ie.category===z);return H.length?H.map((ie,ee)=>`<div class="config-row"><button data-jump="${ke(z)}" class="config-item"><span>${ke(z)}${H.length>1?` ${ee+1}/${H.length}`:""}</span><strong>${ke(ie.part.n)}</strong><small>${f.unchargedIds.includes(ie.part.id)?"¥0 · 共用已计价整卡":Jt(ie.part.p)} · ${ie.part.simulated?"课堂模拟":"真实型号"}</small></button><button class="remove-part" data-remove="${ke(ie.part.id)}" aria-label="移除${ke(ie.part.n)}">×</button></div>`).join(""):`<div class="config-row"><button data-jump="${ke(z)}" class="config-item"><span>${ke(z)}</span><strong>待选择</strong></button></div>`}).join(""),et(),ge(),Ye(),Se()}function Ne(_){if(!_)return k("请先选择一个测试任务。");C=vc(r,v,_,g,u),S=!0,_===b&&(B=C),Ye(),Se(),k(C.passed?"概念检查通过；课堂记录可在纸面任务单完成，仍需真实验证。":`概念检查未通过：${C.missing.join("；")}。`)}function ht(_,f,y){const L=URL.createObjectURL(new Blob([f],{type:y})),z=document.createElement("a");z.href=L,z.download=_,z.click(),setTimeout(()=>URL.revokeObjectURL(L),1e3)}function st(){const _=be(),f=Pe().flatMap(L=>[`【${L.title}】`,...L.rows.map(z=>`- ${z}`)]).join(`
`),y=$().map(L=>`- ${L.category}：${L.part.n}（${L.part.params}；${L.part.simulated?"课堂模拟":"真实型号"}；${_.unchargedIds.includes(L.part.id)?"¥0，共用已计价 RTX 4060 整卡":Jt(L.part.p)}）`).join(`
`)||"- 尚未选择";return`《召唤一名“AI同学”》课堂方案

AI同学名称：${A||"未命名"}
第一优先功能：${b?bn(b):"未确定"}
扩展能力：${E.length?E.map(bn).join("、"):"无"}
预算上限：${g===null?"未设置":Jt(g)}
课堂参考总价：${Jt(_.price)}
选中 ${$().length} 项；增强 ${_.enhanced}/2
方案状态：${zi(X(),B)&&Z()?"课堂方案已形成（非真实系统验证）":"草案，仍需检查或记录"}
信息链覆盖：${X().chainCovered?"已覆盖":"未覆盖"}；基础模块：${X().baseComplete?"完整":"未完整"}

【部件选择】
${y}

【选型理由】
${D||(U?"见纸面任务单":"未填写，可在纸面记录")}

【测试计划】
${R||(U?"见纸面任务单":"未填写，可在纸面记录")}

【风险与边界】
${P||(U?"见纸面任务单":"未选择，可在纸面记录")}

【检查结果】
${f}

说明：本方案用于课堂探究，不是实际采购清单；参数、接口、功耗、驱动、模型许可与真实性能仍需进一步核验。`}e.addEventListener("click",_=>{const y=_.target.closest("button");if(y){if(y.dataset.filter){m=y.dataset.filter,j();return}if(y.dataset.category){h=y.dataset.category,h!=="全部"&&Y(h),j(),document.querySelector("#part-results").scrollTop=0;return}if(y.dataset.select){const L=d(y.dataset.select),z=_c(r,v,L.part.id);if(z.error){k(z.error),We(`未装入：${z.error}原配置保持不变。`);return}v=z.selected;const H=z.removed.map(ie=>d(ie)?.part.n||ie).join("、");We(z.action==="removed"?`已移除 ${L.category}：${L.part.n}。示意外形保留。`:z.action==="replaced"?`已替换 ${L.category}：${H} → ${L.part.n}`:`已加入 ${L.category}：${L.part.n}`),Y(L.category),se(),j(),de();return}}}),document.querySelectorAll("[data-journey-target]").forEach(_=>{const f=()=>document.getElementById(_.dataset.journeyTarget||"")?.scrollIntoView({behavior:"smooth",block:"start"});_.addEventListener("click",f),_.addEventListener("keydown",y=>{(y.key==="Enter"||y.key===" ")&&(y.preventDefault(),f())})}),document.querySelector("#part-search").addEventListener("input",_=>{p=_.target.value.trim(),h="全部",j(),document.querySelector("#part-results").scrollTop=0}),document.querySelector("#clear-search").addEventListener("click",()=>{p="",h="全部",document.querySelector("#part-search").value="",m="all",j()}),e.addEventListener("change",_=>{const f=_.target;if(f.dataset.compare){if(f.checked&&x.length>=3){f.checked=!1,k("最多对比 3 项，请先取消一项。");return}x=f.checked?[...x,f.dataset.compare]:x.filter(y=>y!==f.dataset.compare),j()}}),document.querySelector("#clear-compare").addEventListener("click",()=>{x=[],j()}),document.querySelector("#open-compare").addEventListener("click",()=>{const _=x.map(y=>d(y)).filter(Boolean),f=[["类别",y=>y.category],["当前状态",y=>Hi(v,y.category,y.part.id)?"已选入配置":"未选"],["型号",y=>y.part.n],["原始参数",y=>y.part.params],["参考价",y=>Jt(y.part.p)],["用途",y=>y.part.d],["档位",y=>y.part.t],["性质",y=>`${y.part.simulated?"课堂模拟":"真实型号"}${y.part.extension?" · 扩展":""}`]];document.querySelector("#comparison-content").innerHTML=`<p>不同类别可对照阅读；参数按原文展示，不生成性能排名或兼容结论。</p><div class="compare-table-wrap"><table><thead><tr><th scope="col">项目</th>${_.map((y,L)=>`<th scope="col">候选 ${L+1}</th>`).join("")}</tr></thead><tbody>${f.map(([y,L])=>`<tr><th scope="row">${y}</th>${_.map(z=>`<td>${ke(L(z))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,$e.showModal()}),document.querySelector("#close-compare").addEventListener("click",()=>$e.close()),t.addEventListener("click",_=>{const f=_.target.closest("button");if(f){if(f.dataset.budget){const y=document.querySelector("#selection-budget");y.value=f.dataset.budget==="clear"?"":f.dataset.budget,y.dispatchEvent(new Event("input",{bubbles:!0}));return}if(f.dataset.remove){const y=d(f.dataset.remove);if(!y)return;v=al(v,y.category,y.part.id),se(),j(),de(),We(`已移除 ${y.category}：${y.part.n}；组合中其他选项保留。`);return}if(f.dataset.jump){h=f.dataset.jump,Y(h),j(),document.querySelector("#part-results").scrollTop=0;return}if(f.dataset.guideTarget){const y=f.dataset.guideTarget;l.includes(y)?(h=y,Y(h),j(),document.querySelector("#part-results").scrollTop=0):document.getElementById(y)?.scrollIntoView({behavior:"smooth",block:"start"})}}}),document.querySelector("#selection-name").addEventListener("input",_=>{A=_.target.value,se(!1)}),document.querySelector("#selection-budget").addEventListener("input",_=>{const f=_.target,y=f.valueAsNumber;u=f.value===""&&!f.validity.badInput||Number.isFinite(y)&&y>=0&&y<=1e9,g=u&&f.value!==""?y:null,f.setAttribute("aria-invalid",String(!u)),se(),Se()}),document.querySelector("#primary-options").addEventListener("change",_=>{const f=_.target;f.name==="primary-feature"&&(b=f.value,E=E.filter(y=>y!==b),C=null,S=!1,Ve(),de(),se())}),document.querySelector("#feature-options").addEventListener("change",()=>{E=Array.from(document.querySelectorAll("#feature-options input:checked")).map(_=>_.value).filter(_=>_!==b),C&&C.id!==b&&!E.includes(C.id)&&(C=null),se(!1),ge(),Ye(),Se()}),document.querySelector("#selection-reason").addEventListener("input",_=>{D=_.target.value,se(!1),Se()}),document.querySelector("#test-plan").addEventListener("input",_=>{R=_.target.value,se(!1),Se()}),document.querySelector("#risk-select").addEventListener("change",_=>{P=_.target.value,se(!1),Se()}),document.querySelector("#paper-recorded").addEventListener("change",_=>{U=_.target.checked,se(!1),Se()}),document.querySelector("#test-scenario").addEventListener("change",()=>{C=null,Ye(),Se()}),document.querySelector("#run-test").addEventListener("click",()=>Ne(document.querySelector("#test-scenario").value)),document.querySelector("#run-checks").addEventListener("click",()=>{Se(),k("检查已更新；请根据三类提示完善方案。")}),document.querySelector("#save-selection").addEventListener("click",()=>{if(!u)return k("请先修正预算，再保存。");try{localStorage.setItem(xc,JSON.stringify(W())),T=!1,k("已保存到本机浏览器，包含任务、参数、理由与测试计划。")}catch{k("浏览器存储不可用，请导出课堂报告留存。")}}),document.querySelector("#restore-selection").addEventListener("click",()=>{if(o)return k("目录不可用，不能恢复型号；原存档未修改。");if(!(T&&!window.confirm("恢复将替换当前未保存配置，是否继续？")))try{const _=[xc,...Eg].map(ie=>localStorage.getItem(ie)).find(Boolean);if(!_)return k("尚无本机存档，请先保存一份方案。");const f=JSON.parse(_);if(!f||!f.selected||typeof f.selected!="object")throw new Error;if(f.budget!==null&&f.budget!==void 0&&(!Number.isFinite(Number(f.budget))||Number(f.budget)<0||Number(f.budget)>1e9))throw new Error;const y=Mg(f.selected,r),L=y.skipped;v=y.selected,g=f.budget===null||f.budget===void 0||f.budget===""?null:Number(f.budget),u=!0,A=typeof f.name=="string"?f.name.slice(0,20):"";const z=Array.isArray(f.features)?f.features.filter(ie=>typeof ie=="string"&&Gi.some(ee=>ee.id===ie)):[];b=typeof f.primaryFeature=="string"&&Gi.some(ie=>ie.id===f.primaryFeature)?f.primaryFeature:z[0]||"",E=[...new Set(z.filter(ie=>ie!==b))],D=typeof f.reason=="string"?f.reason.slice(0,4e3):"",R=typeof f.testPlan=="string"?f.testPlan.slice(0,1e3):"",P=typeof f.risk=="string"?f.risk:"",U=f.paperRecorded===!0,T=!1,S=!1,C=null,B=null,document.querySelector("#selection-name").value=A;const H=document.querySelector("#selection-budget");H.value=g===null?"":String(g),H.setAttribute("aria-invalid","false"),document.querySelector("#selection-reason").value=D,document.querySelector("#test-plan").value=R,document.querySelector("#risk-select").value=P,document.querySelector("#paper-recorded").checked=U,Ve(),j(),de(),We(`已恢复 ${$().length} 项选型；型号与总价按当前目录更新。`),k(`已恢复方案${L?`，已跳过 ${L} 项失效或重复型号`:""}；旧存档保留，组合按现行规则重新检查。`)}catch{k("存档无法读取或格式不符；当前配置未替换。")}}),document.querySelector("#export-report").addEventListener("click",()=>{if(!u)return k("请先修正预算，再导出。");ht("AI同学-课堂方案.txt",st(),"text/plain;charset=utf-8"),k("已导出课堂报告，可直接提交或打印。")}),document.querySelector("#export-selection").addEventListener("click",()=>{if(!u)return k("请先修正预算，再导出。");const _={...W(),total:be().price,accounting:be(),checks:Pe(),limitations:"类别覆盖不等于功能可实现；不作性能、容量、功耗与兼容性保证。"};ht("AI同学-选型方案.json",JSON.stringify(_,null,2),"application/json"),k("已导出完整配置、任务链、理由与检查结果。")}),Ve(),j(),de(),o&&(["save-selection","restore-selection","export-report","export-selection","run-checks","run-test"].forEach(_=>{document.getElementById(_).disabled=!0}),We("型号目录不可用，未装配任何选型；原存档未读取或修改。")),ue()}const Qi=[{key:"compute",label:"算力",short:"处理器",description:"决定 AI 同学能多快地处理信息、运行模型。",evidence:"胸腔深蓝核心：用来表示处理器与计算单元。",parts:["chest-core","chest-ring"],color:"#16d7c4"},{key:"memory",label:"存储",short:"记忆",description:"保存资料、模型参数与学习过程中的信息。",evidence:"腹部舱体：用来表示长期存储与工作空间。",parts:["abdomen"],color:"#8b9cff"},{key:"power",label:"电力与安全",short:"能量",description:"为所有模块供电，也要控制温度、风险与边界。",evidence:"双脚底座与关节：用来表示稳定、供能和安全约束。",parts:["left-foot","right-foot","left-foot-trim","right-foot-trim","left-hip","right-hip"],color:"#ffbd69"},{key:"perception",label:"感知",short:"输入",description:"通过视觉、听觉等传感器获得外部信息。",evidence:"面部显示窗与双眼：用来表示接收和识别输入。",parts:["head","visor","eye-lights","left-antenna","right-antenna","left-antenna-tip","right-antenna-tip","neck"],color:"#69b7ff"},{key:"cognition",label:"认知",short:"理解",description:"把输入转化为理解、判断、规划和生成。",evidence:"头部与胸部的组合：认知不是单一零件，而是系统协作。",parts:["head","chest-core","chest-ring"],color:"#d59aff"},{key:"output",label:"表达",short:"输出",description:"把结果通过文字、语音、图像等方式表达出来。",evidence:"显示窗与眼部灯光：象征可见的输出界面。",parts:["visor","eye-lights","chest-ring"],color:"#68e0ef"},{key:"action",label:"行动",short:"执行",description:"把决定转化为动作，与环境发生真实交互。",evidence:"双臂、夹爪与双腿：象征从“会回答”到“能行动”。",parts:["left-shoulder","right-shoulder","left-upper-arm","right-upper-arm","left-elbow","right-elbow","left-forearm","right-forearm","left-hand","right-hand","left-hip","right-hip","left-shin","right-shin"],color:"#ff7f9e"}],wg=document.querySelector("#app");wg.innerHTML=`
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">AI</div><div><strong>召唤一名“AI同学”</strong><span>三维部件实验室 · 课堂示意模型</span></div></div>
      <div class="top-actions"><span class="status-dot"></span><span>本地交互模式</span><button class="ghost-btn" id="reset-view">重置视角</button></div>
    </header>
    <nav class="journey-bar" aria-label="课堂流程">
      <div data-journey-step="1" data-journey-target="mission-block" tabindex="0" role="button"><span>01</span><strong>确定任务</strong></div>
      <i>→</i>
      <div data-journey-step="2" data-journey-target="configuration" tabindex="0" role="button"><span>02</span><strong>选择部件</strong></div>
      <i>→</i>
      <div data-journey-step="3" data-journey-target="test-bench" tabindex="0" role="button"><span>03</span><strong>测试方案</strong></div>
      <i>→</i>
      <div data-journey-step="4" data-journey-target="selection-reason-block" tabindex="0" role="button"><span>04</span><strong>说明取舍</strong></div>
      <p id="journey-summary">先从一个核心任务开始。</p>
    </nav>
    <main class="workspace">
      <aside class="left-panel">
        <div class="panel-kicker">DESIGN DECK</div>
        <h1>拼装一名<br><em>AI同学</em></h1>
        <p class="intro">点击模块，观察它在“AI人类”中的作用，再思考：少了它会怎样？</p>
        <div class="module-list" id="module-list"></div>
        <div class="legend"><span class="legend-swatch"></span><span>蓝绿色 = 当前选中模块</span></div>
      </aside>
      <section class="stage-panel">
        <div class="stage-head"><div><span class="eyebrow">AI CLASSMATE / PROTOTYPE 01</span><h2 id="stage-title">完整结构</h2></div><div class="stage-tools"><button class="tool-btn" id="explode-btn">拆分结构</button><button class="tool-btn" id="wire-btn">线框观察</button></div></div>
        <div class="canvas-wrap" id="canvas-wrap"><div class="canvas-hint"><span class="drag-icon">↻</span><span>拖动旋转 · 滚轮缩放 · 点击部件</span></div><div id="canvas"></div><div class="axis-label"><span>Y</span><i></i><span>X</span></div></div>
        <div class="stage-footer"><div><span class="mini-label">CURRENT BUILD</span><strong id="build-status">7 / 7 模块在线</strong></div><div class="progress"><i id="progress-bar"></i></div><div class="footer-note" id="footer-note">每个部件都在回答一个问题：它让 AI 更像“人类同学”了吗？</div></div>
      </section>
      <aside class="right-panel">
        <div class="inspector-head"><span class="eyebrow">INSPECTOR</span><span class="live-badge">LIVE</span></div>
        <div class="selected-card" id="selected-card"><div class="selected-icon" id="selected-icon">AI</div><div><h3 id="selected-title">完整的 AI 同学</h3><p id="selected-subtitle">选择左侧模块开始探究</p></div></div>
        <div class="info-block"><span class="block-label">它负责什么？</span><p id="selected-description">一名“AI同学”不是一个单独的模型，而是由多个模块协同完成任务。</p></div>
        <div class="info-block"><span class="block-label">在机器人上怎么看？</span><p id="selected-evidence">先观察外形，再追问：这个部件提供了什么能力？它的限制又是什么？</p></div>
        <div class="inspector-actions"><button class="primary-btn" id="focus-btn">聚焦模块</button><button class="secondary-btn" id="hide-btn">隐藏模块</button></div>
        <div class="challenge"><div class="challenge-title"><span>✦</span> 课堂挑战</div><p id="challenge-text">如果只能保留三个模块，你会保留哪三个？为什么？</p><button class="text-btn" id="next-question">换一个问题 →</button></div>
        <div class="note"><span class="note-dot"></span><span>模型说明：本模型是课堂教学用程序化三维示意，不代表真实机器人内部结构。</span></div>
      </aside>
    </main>
  </div>`;const Rg=document.querySelector("#module-list");let sn=null,Ya=!1,Vi=!1;const xi=new Set,yc=["如果只能保留三个模块，你会保留哪三个？为什么？","算力越强，AI就一定越聪明吗？","没有存储的 AI 同学，能持续学习吗？","感知、认知、行动之间，哪一步最容易出错？","如果 AI 会行动，谁来为它的行为负责？"];let Br=0;for(const i of Qi){const e=document.createElement("button");e.className="module-item",e.dataset.key=i.key,e.innerHTML=`<span class="module-index">${String(Qi.indexOf(i)+1).padStart(2,"0")}</span><span class="module-copy"><strong>${i.label}</strong><small>${i.short}</small></span><span class="module-arrow">↗</span>`,e.addEventListener("click",()=>er(i.key)),Rg.appendChild(e)}const Ca=document.querySelector("#canvas-wrap"),Cg=document.querySelector("#canvas"),Ci=new qu;Ci.background=new Fe("#f2f5f4");const pt=new kt(35,1,.01,100),jt=new Wm({antialias:!0,alpha:!1});jt.setPixelRatio(Math.min(window.devicePixelRatio,2));jt.shadowMap.enabled=!0;jt.shadowMap.type=Ec;og(jt);Cg.appendChild(jt.domElement);const $t=cg(pt,jt.domElement);$t.maxDistance=40;$t.target.set(0,2.8,0);const ll=new qt;Ci.add(ll);const Kt=pg({castShadow:!0,receiveShadow:!0});Kt.position.y=0;ll.add(Kt);const Pg=rg();Ci.add(Pg);const ns=new it(new Ys(4.5,64),new Va({color:"#dfe9e6",roughness:.92}));ns.rotation.x=-Math.PI/2;ns.position.y=-1.25;ns.receiveShadow=!0;Ci.add(ns);const ja=new rh(7,14,"#c8d6d2","#e0e9e7");ja.position.y=-1.24;Ci.add(ja);const Zn=new Map;Kt.traverse(i=>{const e=i.userData?.sculptComponent;e?.id&&Zn.set(e.id,i),i.traverse(t=>{t instanceof it&&(t.castShadow=!0,t.receiveShadow=!0)})});const Ka=new Map;for(const[i,e]of Zn)Ka.set(i,{position:e.position.clone(),rotation:e.rotation.clone(),visible:e.visible});function Qs(){const i=Ca.getBoundingClientRect();jt.setSize(i.width,i.height,!1),pt.aspect=i.width/i.height,pt.updateProjectionMatrix(),ag(pt,Kt,{margin:1.22,azimuthDeg:0,elevationDeg:2});const e=new vn().setFromObject(Kt);$t.target.copy(e.getCenter(new N)),$t.update()}function Dg(){Kt.traverse(i=>{if(!(i instanceof it))return;const e=i.material;(e?.color?.getHexString()==="57e8fa"||e?.color?.getHexString()==="20b3d3")&&(e.emissive=new Fe("#39e6ee"),e.emissiveIntensity=2.2)})}Dg();function Za(i){return Qi.find(e=>e.key===i)}function Lg(){document.querySelector("#hide-btn").textContent=sn&&xi.has(sn)?"显示模块":"隐藏模块"}function Ig(){document.querySelectorAll(".module-item").forEach(i=>i.classList.toggle("active",i.dataset.key===sn))}function ul(){Kt.traverse(i=>{const e=i;if(!e.isMesh)return;const t=e.material;t.userData.__baseEmissive&&(t.emissive.copy(t.userData.__baseEmissive),t.emissiveIntensity=t.userData.__baseEmissiveIntensity),e.userData.__highlighted=!1})}function Ng(i){ul();for(const e of i){const t=Zn.get(e);t&&t.traverse(n=>{const s=n;if(!s.isMesh)return;const r=s.material;r.userData.__baseEmissive||(r.userData.__baseEmissive=(r.emissive??new Fe("#000000")).clone(),r.userData.__baseEmissiveIntensity=r.emissiveIntensity??0),r.emissive=new Fe("#12d9c4"),r.emissiveIntensity=.7,s.userData.__highlighted=!0})}}function er(i){sn=i;const e=Za(i);if(Ig(),Lg(),!e){ul(),document.querySelector("#stage-title").textContent="完整结构",document.querySelector("#selected-title").textContent="完整的 AI 同学",document.querySelector("#selected-subtitle").textContent="选择左侧模块开始探究",document.querySelector("#selected-description").textContent="一名“AI同学”不是一个单独的模型，而是由多个模块协同完成任务。",document.querySelector("#selected-evidence").textContent="先观察外形，再追问：这个部件提供了什么能力？它的限制又是什么？",document.querySelector("#selected-icon").style.background="linear-gradient(135deg,#16d7c4,#103943)",document.querySelector("#selected-icon").textContent="AI";return}Ng(e.parts),document.querySelector("#stage-title").textContent=e.label,document.querySelector("#selected-title").textContent=e.label,document.querySelector("#selected-subtitle").textContent=e.short,document.querySelector("#selected-description").textContent=e.description,document.querySelector("#selected-evidence").textContent=e.evidence,document.querySelector("#selected-icon").style.background=`linear-gradient(135deg, ${e.color}, #122c3c)`,document.querySelector("#selected-icon").textContent=e.label.slice(0,1)}function Ja(){for(const[i,e]of Zn){const t=Ka.get(i);e.position.copy(t.position),e.rotation.copy(t.rotation);const n=[...xi].some(s=>Za(s)?.parts.includes(i));e.visible=t.visible&&!n}}function Ug(i){if(Ya=i,Ja(),i){const e={head:new N(0,.28,.22),abdomen:new N(0,-.16,.18),"left-shoulder":new N(-.2,0,.12),"right-shoulder":new N(.2,0,.12),"left-hip":new N(-.14,-.14,.1),"right-hip":new N(.14,-.14,.1)};for(const[t,n]of Object.entries(e)){const s=Zn.get(t),r=Ka.get(t);s&&r&&s.position.copy(r.position).add(n)}}document.querySelector("#explode-btn").textContent=i?"收拢结构":"拆分结构"}function Fg(){const i=Za(sn);if(!i){Qs();return}const e=new vn;for(const d of i.parts){const h=Zn.get(d);h&&e.expandByObject(h)}if(e.isEmpty())return;const t=e.getCenter(new N),n=e.getSize(new N),s=Hs.degToRad(pt.fov*.5),r=Math.atan(Math.tan(s)*Math.max(pt.aspect,.1)),a=n.y*.5/Math.tan(s),o=n.x*.5/Math.tan(r),l=n.z*.75,c=Math.max(4.8,a,o,l)*1.28;pt.position.copy(t).add(new N(0,.08,c)),pt.near=Math.max(.01,c-Math.max(n.z*2.5,1.5)),pt.far=c+Math.max(n.x,n.y,n.z)*6,pt.lookAt(t),pt.updateProjectionMatrix(),$t.minDistance=Math.max(.4,c*.35),$t.maxDistance=Math.max(40,c*8),$t.target.copy(t),$t.update()}function Og(){if(!sn)return;const i=!xi.has(sn);i?xi.add(sn):xi.delete(sn),Ja(),document.querySelector("#hide-btn").textContent=i?"显示模块":"隐藏模块",Qa()}function Qa(){const i=Qi.filter(e=>e.parts.some(t=>Zn.get(t)?.visible)).length;document.querySelector("#build-status").textContent=`${i} / 7 模块在线`,document.querySelector("#progress-bar").style.width=`${Math.max(12,i/7*100)}%`}function hl(){Vi=!Vi,Kt.traverse(i=>{if(i instanceof it){const e=i.material;e.wireframe=Vi}}),document.querySelector("#wire-btn").textContent=Vi?"关闭线框":"线框观察"}jt.domElement.addEventListener("pointerdown",i=>{const e=jt.domElement.getBoundingClientRect(),t=new De((i.clientX-e.left)/e.width*2-1,-((i.clientY-e.top)/e.height)*2+1),n=new sh;n.setFromCamera(t,pt);const r=n.intersectObject(Kt,!0).find(c=>c.object.userData?.sculptComponent||c.object.parent?.userData?.sculptComponent);if(!r)return;let a=r.object;for(;a&&!a.userData?.sculptComponent;)a=a.parent;const o=a?.userData?.sculptComponent?.id;if(!o)return;const l=Qi.find(c=>c.parts.includes(o));l&&er(l.key)});document.querySelector("#explode-btn").addEventListener("click",()=>Ug(!Ya));document.querySelector("#wire-btn").addEventListener("click",hl);document.querySelector("#reset-view").addEventListener("click",()=>{sn=null,xi.clear(),Ya=!1,Ja(),er(null),Qs(),document.querySelector("#explode-btn").textContent="拆分结构",document.querySelector("#hide-btn").textContent="隐藏模块",Vi&&hl(),Qa()});document.querySelector("#focus-btn").addEventListener("click",Fg);document.querySelector("#hide-btn").addEventListener("click",Og);document.querySelector("#next-question").addEventListener("click",()=>{Br=(Br+1)%yc.length,document.querySelector("#challenge-text").textContent=yc[Br]});Ag(er);new ResizeObserver(()=>{const i=Ca.getBoundingClientRect();i.width<=0||i.height<=0||(jt.setSize(i.width,i.height,!1),pt.aspect=i.width/i.height,pt.updateProjectionMatrix())}).observe(Ca);window.addEventListener("resize",Qs);Qs();Qa();const Bg=mg(Kt);window.__IMG2THREEJS_CAPTURE__={...Bg,setCaptureMode(i){ns.visible=!i,ja.visible=!i,document.querySelector(".canvas-hint")?.style.setProperty("display",i?"none":"flex"),document.querySelector(".axis-label")?.style.setProperty("display",i?"none":"flex")},async setCamera(i){const t=new vn().setFromObject(Kt).getCenter(new N),n=new N(...i.target??[t.x,t.y,t.z]),s=Math.max(4.8,i.distance??9.2),r=Hs.degToRad(i.azimuthDeg??0),a=Hs.degToRad(i.elevationDeg??2),o=Math.cos(a)*s;pt.position.set(n.x+Math.sin(r)*o,n.y+Math.sin(a)*s,n.z+Math.cos(r)*o),pt.near=.01,pt.far=100,pt.lookAt(n),pt.updateProjectionMatrix(),$t.target.copy(n),$t.update()}};window.__IMG2THREEJS_READY__=!0;function dl(){requestAnimationFrame(dl),$t.update(),jt.render(Ci,pt)}dl();
