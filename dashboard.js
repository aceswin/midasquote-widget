/*
 * MidasQuote Dashboard v1.0
 * Shop owner backend panel
 * Loads based on Memberstack member's shopToken
 */

(function () {

  // Bundled QR code generator (qrcode-generator v2.0.4, MIT License, Kazuhiko Arase) — avoids external CDN dependency
  function MQ_QR_LIB_FACTORY() {
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1})},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(o*r,n*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});
    return qrcode;
  }

  const CONFIG = {
      AIRTABLE_TOKEN:     'patBtaoCbxqqQzRId.4342548ea07fbac4e5998244a4eaa09db09e9ab6494efb175664bd1f9e0462b3',
    BASE_ID:            'app4zrMlVLwF2xn4h',
    SHOPS_TABLE:        'tbl8PoF2Mu3sAdlMs',
    PRICING_TABLE:      'tblu6AYZs8h7SIaQl',
    SPECIALTY_TABLE:    'tbloaXeEM5K7TOZCD',
    LEADS_TABLE:        'tblPcoTI8zCCHLICi',
    LINE_ITEMS_TABLE:   'tblCkJsJ2OC6DgXok',
    RESEND_API_KEY:     're_bkjuB6kc_HvraLCVCJntfLMjVBEjEkWuV',
    EMAIL_WORKER:       'https://midasquote-email.jordan132001.workers.dev',
    FROM_EMAIL:         'quotes@midasquote.com',
  };

  const AT_BASE = `https://api.airtable.com/v0/${CONFIG.BASE_ID}`;
  const AT_HEADS = { 'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  async function atGet(table, formula) {
    const url = `${AT_BASE}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`;
    const res = await fetch(url, { headers: AT_HEADS });
    const data = await res.json();
    return data.records || [];
  }

  async function atUpdate(table, id, fields) {
    const res = await fetch(`${AT_BASE}/${table}/${id}`, {
      method: 'PATCH', headers: AT_HEADS,
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atCreate(table, fields) {
    const res = await fetch(`${AT_BASE}/${table}`, {
      method: 'POST', headers: AT_HEADS,
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atDelete(table, id) {
    const res = await fetch(`${AT_BASE}/${table}/${id}`, {
      method: 'DELETE', headers: AT_HEADS
    });
    return await res.json();
  }

  function fmt(n) { return '$' + Math.round(n || 0).toLocaleString(); }
  function gv(id) { const e = document.getElementById(id); return e ? e.value : ''; }
  function gn(id, d = 0) { const v = parseFloat(gv(id)); return isNaN(v) ? d : v; }
  function el(id) { return document.getElementById(id); }
  function show(id) { const e = el(id); if (e) e.style.display = 'block'; }
  function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }
  function showMsg(id, msg, type = 'success') {
    const e = el(id);
    if (!e) return;
    e.textContent = msg;
    e.className = `mq-msg mq-msg-${type}`;
    e.style.display = 'block';
    setTimeout(() => { e.style.display = 'none'; }, 3000);
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #midasquote-dashboard *{box-sizing:border-box;margin:0;padding:0}
      #midasquote-dashboard{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;min-height:100vh;width:100vw;position:relative;left:50%;right:50%;margin-left:-50vw;margin-right:-50vw}
      #midasquote-dashboard .mq-topbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 2rem;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100}
      #midasquote-dashboard .mq-topbar-brand{font-size:16px;font-weight:700;color:#111;display:flex;align-items:center;gap:8px}
      #midasquote-dashboard .mq-topbar-shop{font-size:13px;color:#6b7280}
      #midasquote-dashboard .mq-topbar-actions{display:flex;align-items:center;gap:12px}
      #midasquote-dashboard .mq-btn{padding:8px 16px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#111;font-family:inherit;transition:all 0.15s}
      #midasquote-dashboard .mq-btn:hover{background:#f9fafb}
      #midasquote-dashboard .mq-btn-primary{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
      #midasquote-dashboard .mq-btn-primary:hover{opacity:0.88;background:#1a1a1a}
      #midasquote-dashboard .mq-btn-danger{background:#fff;color:#dc2626;border-color:#fca5a5}
      #midasquote-dashboard .mq-btn-danger:hover{background:#fef2f2}
      #midasquote-dashboard .mq-btn-sm{padding:5px 10px;font-size:12px}
      #midasquote-dashboard .mq-layout{display:flex;min-height:calc(100vh - 60px);width:100%}
      #midasquote-dashboard .mq-sidebar{width:220px;background:#fff;border-right:1px solid #e5e7eb;padding:1.5rem 0;flex-shrink:0}
      #midasquote-dashboard .mq-nav-item{display:flex;align-items:center;gap:10px;padding:11px 1.5rem;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;transition:all 0.15s;border-left:3px solid transparent}
      #midasquote-dashboard .mq-nav-item:hover{color:#111;background:#f9fafb}
      #midasquote-dashboard .mq-nav-item.active{color:#111;background:#f9fafb;border-left-color:#1a1a1a}
      #midasquote-dashboard .mq-nav-icon{font-size:16px;width:20px;text-align:center}
      #midasquote-dashboard .mq-nav-section{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;padding:1.25rem 1.5rem 0.5rem}
      #midasquote-dashboard .mq-content{flex:1;padding:2.5rem;overflow-y:visible}
      #midasquote-dashboard .mq-page{display:none}
      #midasquote-dashboard .mq-page.active{display:block}
      #midasquote-dashboard .mq-page-title{font-size:22px;font-weight:700;color:#111;margin-bottom:6px}
      #midasquote-dashboard .mq-page-sub{font-size:13px;color:#6b7280;margin-bottom:2rem}
      #midasquote-dashboard .mq-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.75rem;margin-bottom:1.5rem}
      #midasquote-dashboard .mq-card-title{font-size:13px;font-weight:600;color:#111;margin-bottom:1rem;display:flex;align-items:center;gap:8px}
      #midasquote-dashboard .mq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
      #midasquote-dashboard .mq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem}
      #midasquote-dashboard .mq-field{display:flex;flex-direction:column;gap:5px}
      #midasquote-dashboard .mq-label{font-size:12px;font-weight:500;color:#374151}
      #midasquote-dashboard .mq-hint{font-size:11px;color:#9ca3af;margin-top:2px}
      #midasquote-dashboard input[type=text],#midasquote-dashboard input[type=email],#midasquote-dashboard input[type=tel],#midasquote-dashboard input[type=number],#midasquote-dashboard input[type=url],#midasquote-dashboard select,#midasquote-dashboard textarea{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%}
      #midasquote-dashboard input:focus,#midasquote-dashboard select:focus,#midasquote-dashboard textarea:focus{outline:none;border-color:#1a1a1a}
      #midasquote-dashboard textarea{resize:vertical;min-height:80px}
      #midasquote-dashboard .mq-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1.25rem;margin-bottom:2rem}
      #midasquote-dashboard .mq-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem}
      #midasquote-dashboard .mq-stat-val{font-size:26px;font-weight:700;color:#111;margin-bottom:6px}
      #midasquote-dashboard .mq-stat-lbl{font-size:12px;color:#6b7280;font-weight:500}
      #midasquote-dashboard .mq-stat-green .mq-stat-val{color:#16a34a}
      #midasquote-dashboard .mq-table{width:100%;border-collapse:collapse}
      #midasquote-dashboard .mq-table th{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:left}
      #midasquote-dashboard .mq-table td{font-size:13px;padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#111}
      #midasquote-dashboard .mq-table tr:last-child td{border-bottom:none}
      #midasquote-dashboard .mq-table tr:hover td{background:#f9fafb}
      #midasquote-dashboard .mq-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
      #midasquote-dashboard .mq-badge-green{background:#dcfce7;color:#166534}
      #midasquote-dashboard .mq-badge-blue{background:#dbeafe;color:#1e40af}
      #midasquote-dashboard .mq-badge-yellow{background:#fef9c3;color:#854d0e}
      #midasquote-dashboard .mq-badge-red{background:#fee2e2;color:#991b1b}
      #midasquote-dashboard .mq-badge-grey{background:#f3f4f6;color:#6b7280}
      #midasquote-dashboard .mq-embed-box{background:#1a1a1a;border-radius:8px;padding:1rem;font-family:monospace;font-size:12px;color:#a3e635;line-height:1.6;position:relative;margin-top:1rem;word-break:break-all}
      #midasquote-dashboard .mq-copy-btn{position:absolute;top:8px;right:8px;background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit}
      #midasquote-dashboard .mq-copy-btn:hover{background:#4b5563}
      #midasquote-dashboard .mq-spec-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6}
      #midasquote-dashboard .mq-spec-row:last-child{border-bottom:none}
      #midasquote-dashboard .mq-spec-name{flex:1;font-size:13px;color:#111}
      #midasquote-dashboard .mq-spec-price{width:100px}
      #midasquote-dashboard .mq-msg{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:1rem;display:none}
      #midasquote-dashboard .mq-msg-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
      #midasquote-dashboard .mq-msg-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
      #midasquote-dashboard .mq-loading{text-align:center;padding:3rem;color:#6b7280;font-size:14px}
      #midasquote-dashboard .mq-divider{height:1px;background:#e5e7eb;margin:1.5rem 0}
      #midasquote-dashboard .mq-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0}
      #midasquote-dashboard .mq-toggle{width:40px;height:22px;background:#d1d5db;border-radius:11px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0}
      #midasquote-dashboard .mq-toggle.on{background:#1a1a1a}
      #midasquote-dashboard .mq-toggle::after{content:'';position:absolute;width:18px;height:18px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      #midasquote-dashboard .mq-toggle.on::after{left:20px}
      #midasquote-dashboard .mq-empty{text-align:center;padding:3rem;color:#9ca3af;font-size:14px}
      #midasquote-dashboard .mq-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}

      @media (max-width: 768px) {
        #midasquote-dashboard .mq-layout{flex-direction:column}
        #midasquote-dashboard .mq-sidebar{width:100%;padding:0.5rem 0;display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid #e5e7eb;-webkit-overflow-scrolling:touch}
        #midasquote-dashboard .mq-nav-section{display:none}
        #midasquote-dashboard .mq-nav-item{flex-shrink:0;border-left:none;border-bottom:3px solid transparent;padding:10px 14px;white-space:nowrap}
        #midasquote-dashboard .mq-nav-item.active{border-left-color:transparent;border-bottom-color:#1a1a1a}
        #midasquote-dashboard .mq-content{padding:1.25rem}
        #midasquote-dashboard .mq-topbar{padding:0 1rem;flex-wrap:wrap;height:auto;min-height:60px}
        #midasquote-dashboard .mq-topbar-brand{font-size:14px}
        #midasquote-dashboard .mq-card{padding:1.25rem}
        #midasquote-dashboard .mq-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        #midasquote-dashboard .mq-table{min-width:560px}
      }
    `;
    document.head.appendChild(s);
  }

window.logoutMember = async function () {
  try {
    await window.$memberstackDom.logout();

    // Change this if your login page URL is different
    window.location.href = "/login";
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Logout failed. Please refresh and try again.");
  }
};

  function buildHTML(shop) {
    const token = shop['Shop token'] || '';
    const embedCode = '&lt;div id="midasquote-widget"&gt;&lt;/div&gt;\n&lt;script src="https://widget.midasquote.com/widget.js?shop=' + token + '"&gt;&lt;/script&gt;';
    window._mqRawEmbedCode = '<div id="midasquote-widget"></div>\n<scr' + 'ipt src="https://widget.midasquote.com/widget.js?shop=' + token + '"></scr' + 'ipt>';

    return `
      <div class="mq-topbar">
        <div>
          <div class="mq-topbar-brand">⚡ MidasQuote</div>
          <div class="mq-topbar-shop">${shop['Shop name'] || 'My Shop'}</div>
        </div>
        <div class="mq-topbar-actions">
          <button class="mq-btn mq-btn-sm" onclick="window.open('https://widget.midasquote.com/?shop=${token}','_blank')">Preview widget ↗</button>
          <button 
  type="button"
  class="mq-btn mq-btn-sm"
  onclick="logoutMember()">
  Log out
</button>
        </div>
      </div>

      <div class="mq-layout">
        <div class="mq-sidebar">
          <div class="mq-nav-section">Overview</div>
          <div class="mq-nav-item active" onclick="mqNav('overview',this)"><span class="mq-nav-icon">📊</span> Dashboard</div>
          <div class="mq-nav-item" onclick="mqNav('leads',this)"><span class="mq-nav-icon">👥</span> Leads</div>
          <div class="mq-nav-section">Setup</div>
          <div class="mq-nav-item" onclick="mqNav('shop',this)"><span class="mq-nav-icon">🏪</span> Shop info</div>
          <div class="mq-nav-item" onclick="mqNav('pricing',this)"><span class="mq-nav-icon">💰</span> Pricing</div>
          <div class="mq-nav-item" onclick="mqNav('specialty',this)"><span class="mq-nav-icon">⭐</span> Specialty items</div>
          <div class="mq-nav-item" onclick="mqNav('embed',this)"><span class="mq-nav-icon">🔗</span> Embed code</div>
          <div class="mq-nav-item" onclick="mqNav('products',this)"><span class="mq-nav-icon">📦</span> My Products</div>
          <div class="mq-nav-item" onclick="mqNav('marketing',this)"><span class="mq-nav-icon">📣</span> Marketing Kit</div>
          <div class="mq-nav-item" onclick="mqNav('billing',this)"><span class="mq-nav-icon">💳</span> Billing</div>
        </div>

        <div class="mq-content">

          <!-- OVERVIEW -->
          <div class="mq-page active" id="mq-page-overview">
            <div class="mq-page-title">Welcome back 👋</div>
            <div class="mq-page-sub">Here's what's happening with your widget</div>
            <div class="mq-stat-grid" id="mq-stats">
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-leads">—</div><div class="mq-stat-lbl">Total leads</div></div>
              <div class="mq-stat mq-stat-green"><div class="mq-stat-val" id="mq-stat-new">—</div><div class="mq-stat-lbl">New this week</div></div>
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-booked">—</div><div class="mq-stat-lbl">Booked</div></div>
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-value">—</div><div class="mq-stat-lbl">Est. pipeline value</div></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">📋 Recent leads</div>
              <div id="mq-recent-leads"><div class="mq-loading">Loading leads...</div></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">🔗 Your widget embed code</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:8px">Copy and paste this into your website where you want the widget to appear.</p>
              <div class="mq-embed-box" id="mq-embed-preview"><span>${embedCode}</span><button class="mq-copy-btn" id="mq-copy-embed-1">Copy</button></div>
            </div>
          </div>

          <!-- LEADS -->
          <div class="mq-page" id="mq-page-leads">
            <div class="mq-section-header">
              <div>
                <div class="mq-page-title">Leads</div>
                <div class="mq-page-sub">All quote requests from your widget</div>
              </div>
              <select id="mq-lead-filter" onchange="mqFilterLeads()" style="font-size:13px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit">
                <option value="">All leads</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Booked">Booked</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div id="mq-leads-msg"></div>
            <div style="margin-bottom:1rem;text-align:right">
              <button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteAllLeads()">🗑️ Clear all leads</button>
            </div>
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div id="mq-leads-table"><div class="mq-loading">Loading leads...</div></div>
            </div>
          </div>

          <!-- SHOP INFO -->
          <div class="mq-page" id="mq-page-shop">
            <div class="mq-page-title">Shop info</div>
            <div class="mq-page-sub">This info appears on your widget and in emails to customers</div>
            <div class="mq-card">
              <div id="mq-shop-msg"></div>
              <div class="mq-grid2" style="margin-bottom:1rem">
                <div class="mq-field"><label class="mq-label">Shop name</label><input type="text" id="mq-shop-name"/></div>
                <div class="mq-field"><label class="mq-label">Phone number</label><input type="tel" id="mq-shop-phone"/></div>
                <div class="mq-field"><label class="mq-label">City</label><input type="text" id="mq-shop-city"/></div>
                <div class="mq-field"><label class="mq-label">Website URL</label><input type="url" id="mq-shop-website"/></div>
                <div class="mq-field"><label class="mq-label">Lead notify email</label><input type="email" id="mq-shop-email"/><span class="mq-hint">Where new lead notifications go</span></div>
                <div class="mq-field"><label class="mq-label">Brand colour</label><input type="text" id="mq-shop-color" placeholder="#1a1a1a"/><span class="mq-hint">Hex code for widget buttons</span></div>
              </div>
              <div class="mq-grid2" style="margin-bottom:1rem">
                <div class="mq-field">
                  <label class="mq-label">Quote range — low (% below estimate)</label>
                  <input type="number" id="mq-shop-range-low" placeholder="10" min="0" max="50"/>
                  <span class="mq-hint">Default 10 — quote shows up to 10% below your estimate</span>
                </div>
                <div class="mq-field">
                  <label class="mq-label">Quote range — high (% above estimate)</label>
                  <input type="number" id="mq-shop-range-high" placeholder="15" min="0" max="50"/>
                  <span class="mq-hint">Default 15 — quote shows up to 15% above your estimate</span>
                </div>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">Logo URL</label>
                <input type="url" id="mq-shop-logo" placeholder="https://yoursite.com/logo.png"/>
                <span class="mq-hint">Direct link to your logo image — appears in the widget header</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Disclaimer text</label>
                <textarea id="mq-shop-disclaimer" placeholder="Ballpark estimate only. Contact us for a full quote."></textarea>
                <span class="mq-hint">Shown at the bottom of every quote</span>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">"Book a consultation" link <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
                <input type="url" id="mq-shop-consult-link" placeholder="https://yoursite.com/contact"/>
                <span class="mq-hint">If set, the widget's "Book a consultation" button opens this page in a new tab instead of the default contact form</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Or, consultation email <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
                <input type="email" id="mq-shop-consult-email" placeholder="sales@yourshop.com"/>
                <span class="mq-hint">Used only if no link is set above — opens a pre-filled email instead</span>
              </div>
              <div class="mq-toggle-row" style="margin-bottom:1.5rem">
                <div>
                  <div style="font-size:13px;font-weight:500;color:#111">Show "View our products" link on widget</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px">Customers can browse your showroom before getting a quote</div>
                </div>
                <div class="mq-toggle on" id="mq-showroom-toggle" onclick="mqToggleShowroom()"></div>
              </div>
              <button class="mq-btn mq-btn-primary" onclick="mqSaveShop()">Save shop info</button>
            </div>
          </div>

          <!-- PRICING -->
          <div class="mq-page" id="mq-page-pricing">
            <div id="mq-pricing-helper-v2"></div>
          </div>

          <!-- SPECIALTY ITEMS -->
          <div class="mq-page" id="mq-page-specialty">
            <div class="mq-section-header">
              <div>
                <div class="mq-page-title">Specialty items</div>
                <div class="mq-page-sub">Add-ons that appear as options in your widget</div>
              </div>
              <button class="mq-btn mq-btn-primary mq-btn-sm" onclick="mqAddSpecItem()">+ New item</button>
              <button class="mq-btn mq-btn-sm" onclick="mqSaveAllSpecItems()" style="margin-left:6px">💾 Save all</button>
            </div>
            <div id="mq-spec-msg"></div>
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div id="mq-spec-list"><div class="mq-loading">Loading specialty items...</div></div>
            </div>
          </div>

          <!-- EMBED CODE -->
          <div class="mq-page" id="mq-page-embed">
            <div class="mq-page-title">Embed code</div>
            <div class="mq-page-sub">Paste this code into your website where you want the widget to appear</div>
            <div class="mq-card">
              <div class="mq-card-title">🎯 Quote page header <span style="font-weight:400;color:#9ca3af;font-size:12px">(optional)</span></div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">A clean intro section to place above your widget. Here's what it looks like:</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:0.5rem;margin-bottom:1.25rem">
                <div id="mq-mk-header-preview"></div>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin-bottom:8px">Code to copy — paste this directly above your trust bar and embed code below:</p>
              <div class="mq-embed-box"><span id="mq-mk-header-display"></span><button class="mq-copy-btn" id="mq-mk-header-copy">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">✨ Trust bar <span style="font-weight:400;color:#9ca3af;font-size:12px">(optional)</span></div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Paste this code snippet directly above your widget embed code below. Here's what it looks like:</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1.5rem;margin-bottom:1.25rem">
                <div id="mq-mk-trustbar-preview"></div>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin-bottom:8px">Code to copy:</p>
              <div class="mq-embed-box"><span id="mq-mk-trustbar-display"></span><button class="mq-copy-btn" id="mq-mk-trustbar-copy">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">📋 Your embed code</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Copy the code below and paste it into your website's HTML where you want the quote widget to appear. Works on Wix, Squarespace, WordPress, Webflow, GoDaddy and any custom site.</p>
              <div class="mq-embed-box"><span>${embedCode}</span><button class="mq-copy-btn" id="mq-copy-embed-2">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">📱 Shop mode</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Use this link to pull up the widget on your phone or tablet for walk-in customers. No lead capture — just the quote tool.</p>
              <div class="mq-embed-box">https://widget.midasquote.com/?shop=${token}&mode=shop<button class="mq-copy-btn" onclick="mqCopyText('https://widget.midasquote.com/?shop=${token}&mode=shop',this)">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">💡 Installation help</div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:#374151;line-height:1.6">
                <div><strong>Wix:</strong> Add → Embed → Embed a Widget → paste your code</div>
                <div><strong>Squarespace:</strong> Edit page → Add block → Code → paste your code</div>
                <div><strong>WordPress:</strong> Add block → Custom HTML → paste your code</div>
                <div><strong>Webflow:</strong> Add element → Embed → paste your code</div>
                <div><strong>Need help?</strong> Email <a href="mailto:hello@midasquote.com" style="color:#1a1a1a">hello@midasquote.com</a></div>
              </div>
            </div>
          </div>

          <!-- MY PRODUCTS -->
          <div class="mq-page" id="mq-page-products">
            <div class="mq-page-title">My Products</div>
            <div class="mq-page-sub">Add photos to your materials and options — these appear on your customer showroom page</div>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:13px;color:#92400e;line-height:1.7">
              <strong>💡 How to add a photo URL:</strong><br>
              <strong>Option 1 —</strong> Find a photo on your website, Facebook, or anywhere online. Right-click the image → <em>"Copy image address"</em> → paste it in the box below.<br>
              <strong>Option 2 —</strong> Upload your own photo for free at <a href="https://imgbb.com" target="_blank" style="color:#92400e;font-weight:600">imgbb.com</a> — upload, then copy the "Direct link" and paste it below.<br>
              <strong>Option 3 —</strong> Click <em>"📷 Choose from library"</em> to pick from our curated cabinet & countertop photo collection.
            </div>
            <div id="mq-products-msg"></div>
            <div id="mq-products-content"><div class="mq-loading">Loading your products...</div></div>
            <div class="mq-card" style="margin-top:1rem">
              <div class="mq-card-title">🔗 Your showroom link</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Share this with customers so they can browse your products before getting a quote.</p>
              <div class="mq-embed-box"><span id="mq-showroom-link-text"></span><button class="mq-copy-btn" id="mq-showroom-copy-btn">Copy</button></div>
              <button class="mq-btn" style="margin-top:10px" id="mq-showroom-open-btn">Open showroom ↗</button>
            </div>
          </div>

          <!-- BILLING -->
          <div class="mq-page" id="mq-page-billing">
            <div class="mq-page-title">Billing</div>
            <div class="mq-page-sub">Manage your subscription, payment method, and invoices</div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">📋 Current plan</div>
              <div id="mq-billing-plan" style="font-size:14px;color:#6b7280;margin-bottom:1.25rem">Loading plan info...</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="mq-btn mq-btn-primary" onclick="mqOpenBillingPortal()">Manage plan</button>
                <button class="mq-btn" onclick="mqUpgradeToAnnual()">Upgrade to annual</button>
              </div>
            </div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">💳 Payment method</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Update your credit card or billing details.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">Update payment method</button>
            </div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">🧾 Invoices</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">View and download your past invoices.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">View invoices</button>
            </div>

            <div class="mq-card" style="border-color:#fca5a5">
              <div class="mq-card-title" style="color:#dc2626">⚠️ Cancel subscription</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:6px;line-height:1.6">We're sorry to see you go. You can cancel at any time — your widget stays active until the end of your current billing period.</p>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.6">Your leads and pricing data will be available for 30 days after cancellation.</p>
              <button class="mq-btn mq-btn-danger" onclick="mqOpenBillingPortal()">Cancel subscription</button>
            </div>
          </div>

          <!-- MARKETING KIT -->
          <div class="mq-page" id="mq-page-marketing">
            <div class="mq-page-title">Marketing Kit</div>
            <div class="mq-page-sub">Ready-made copy to help you promote your new quote widget — personalized with your shop's link</div>

            <div class="mq-card">
              <div class="mq-card-title">📱 Social media posts</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Copy and paste these straight into Facebook or Instagram.</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem">
                <label class="mq-label" style="display:block;margin-bottom:6px">Link to use in these posts</label>
                <div style="display:flex;gap:8px">
                  <input type="url" id="mq-mk-post-link" placeholder="https://yoursite.com/get-a-quote" style="flex:1"/>
                  <button class="mq-btn mq-btn-sm" id="mq-mk-post-link-apply" style="flex-shrink:0">Apply</button>
                </div>
                <span class="mq-hint">Paste the link to your quote page — if you leave this blank, the posts below use your raw widget link instead</span>
              </div>
              <div id="mq-mk-social"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">🖼️ Social graphic — ready to post</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">A square Instagram/Facebook-ready graphic with your shop name, brand colour, and quote link already on it. Download and post — no design needed.</p>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1rem">
                <canvas id="mq-mk-canvas" width="1080" height="1080" style="width:280px;height:280px;border-radius:14px;display:block"></canvas>
                <div style="display:flex;gap:8px;width:100%;max-width:280px">
                  <label class="mq-btn mq-btn-sm" style="flex:1;text-align:center;cursor:pointer">
                    📷 Add background photo
                    <input type="file" id="mq-mk-bg-photo" accept="image/*" style="display:none"/>
                  </label>
                  <button class="mq-btn mq-btn-sm" id="mq-mk-bg-remove" style="flex-shrink:0">✕</button>
                </div>
                <span style="font-size:11px;color:#9ca3af;text-align:center">Optional — use a photo of your shop or recent work for the background</span>
                <div id="mq-mk-overlay-row" style="display:none;width:100%;max-width:280px;align-items:center;gap:10px">
                  <span style="font-size:11px;color:#6b7280;white-space:nowrap">Darkness</span>
                  <input type="range" id="mq-mk-overlay-slider" min="0" max="90" value="62" style="flex:1"/>
                  <span style="font-size:11px;color:#6b7280;width:28px;text-align:right" id="mq-mk-overlay-val">62%</span>
                </div>
                <button class="mq-btn mq-btn-primary" id="mq-mk-download-btn" style="width:100%;max-width:280px">⬇️ Download graphic (PNG)</button>
              </div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">🏷️ Headline options for your website</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Use one of these above your embedded widget.</p>
              <div id="mq-mk-headlines"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">💬 Direct message template</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Send this to past customers or leads who might have a future project.</p>
              <div id="mq-mk-dm"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">🖨️ Printable QR poster</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">A print-ready poster with a QR code linking straight to your quote page — perfect for a sandwich board, front desk, or restroom poster. Walk-in customers just scan and go.</p>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1rem">
                <canvas id="mq-mk-qr-canvas" width="1080" height="1620" style="width:200px;height:300px;border-radius:10px;display:block"></canvas>
                <div style="display:flex;gap:8px;width:100%;max-width:280px">
                  <label class="mq-btn mq-btn-sm" style="flex:1;text-align:center;cursor:pointer">
                    📷 Add background photo
                    <input type="file" id="mq-mk-qr-bg-photo" accept="image/*" style="display:none"/>
                  </label>
                  <button class="mq-btn mq-btn-sm" id="mq-mk-qr-bg-remove" style="flex-shrink:0">✕</button>
                </div>
                <span style="font-size:11px;color:#9ca3af;text-align:center">Uses the link from "Social media posts" above — set it there if you haven't already</span>
                <div id="mq-mk-qr-overlay-row" style="display:none;width:100%;max-width:280px;align-items:center;gap:10px">
                  <span style="font-size:11px;color:#6b7280;white-space:nowrap">Darkness</span>
                  <input type="range" id="mq-mk-qr-overlay-slider" min="0" max="90" value="62" style="flex:1"/>
                  <span style="font-size:11px;color:#6b7280;width:28px;text-align:right" id="mq-mk-qr-overlay-val">62%</span>
                </div>
                <button class="mq-btn mq-btn-primary" id="mq-mk-qr-download-btn" style="width:100%;max-width:280px">⬇️ Download poster (PNG)</button>
              </div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">📍 Where to post</div>
              <div style="font-size:13px;color:#374151;line-height:2">
                ✓ Your website homepage or a dedicated "Get a Quote" page<br>
                ✓ Pin a post to the top of your Facebook Business Page<br>
                ✓ Local Facebook homeowner / renovation groups (check group rules first)<br>
                ✓ Instagram bio link<br>
                ✓ Google Business Profile — add to your website field or post an update<br>
                ✓ Email signature<br>
                ✓ A QR code sign for walk-in customers to scan in-store
              </div>
            </div>

            <div class="mq-card" style="border-color:#86efac;background:#f0fdf4">
              <div class="mq-card-title">✅ Pre-launch checklist</div>
              <div style="font-size:13px;color:#166534;line-height:2">
                ☐ Widget is embedded and tested on your site<br>
                ☐ Link works on both desktop and mobile<br>
                ☐ You've tried the quote flow yourself at least once<br>
                ☐ Your shop info (name, phone, logo) looks correct in the widget<br>
                ☐ You know new leads land in your Leads tab
              </div>
            </div>
          </div>

        </div>
      </div>
      <!-- Hidden Memberstack trigger for billing portal -->
      <a data-ms-modal="profile" data-ms-modal-tab="plans" href="#" id="mq-ms-plans-trigger" style="display:none">plans</a>
    `;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  window.mqUpgradeToAnnual = async function() {
    try {
      await window.$memberstackDom.purchasePlansWithCheckout({
        priceId: 'prc_midasquote-annual-0o2d0axt',
      });
    } catch(e) {
      console.error('Upgrade error:', e);
      alert('Unable to open upgrade checkout. Please email hello@midasquote.com to upgrade your plan.');
    }
  };

  window.mqOpenBillingPortal = async function() {
    try {
      // launchStripeCustomerPortal opens Stripe billing directly — cancel, update card, invoices all in one
      await window.$memberstackDom.launchStripeCustomerPortal({});
    } catch(e) {
      console.error('Billing portal error:', e);
      // Fallback to profile modal
      try { await window.$memberstackDom.openModal('PROFILE'); } catch(e2) {}
    }
  };

  window.mqLogout = function() {
    let attempts = 0;
    const tryLogout = async () => {
      if (window.$memberstackDom?.logout) {
        try { await window.$memberstackDom.logout(); window.location.reload(); }
        catch(e) { window.location.href = '/?ms-logout=true'; }
        return;
      }
      attempts++;
      if (attempts < 20) setTimeout(tryLogout, 250);
      else window.location.href = '/?ms-logout=true';
    };
    tryLogout();
  };

  window.mqNav = function(page, el) {
    document.querySelectorAll('#midasquote-dashboard .mq-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('#midasquote-dashboard .mq-page').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const pageEl = document.getElementById('mq-page-' + page);
    if (pageEl) pageEl.classList.add('active');
  };

  // ============================================================
  // COPY HELPERS
  // ============================================================
  window.mqCopyEmbed = function(btn) {
    const code = window._mqRawEmbedCode || '';
    navigator.clipboard.writeText(code).then(() => {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
    });
  };
  window.mqCopyText = function(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
    });
  };

  // ============================================================
  // LOAD DATA
  // ============================================================
  async function loadShop(shopToken) {
    const shops = await atGet(CONFIG.SHOPS_TABLE, `{Shop token} = "${shopToken}"`);
    return shops.length ? shops[0] : null;
  }

  async function loadPricing(shopName) {
    const recs = await atGet(CONFIG.PRICING_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs.length ? recs[0] : null;
  }

  async function loadLeads(shopName) {
    const recs = await atGet(CONFIG.LEADS_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs;
  }

  async function loadSpecialty(shopName) {
    const recs = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs.sort((a, b) => (a.fields['Sort order'] || 0) - (b.fields['Sort order'] || 0));
  }

  const DEFAULT_SPECIALTY_ITEMS = [
    { name:'Tall cabinets',              price:0,  perFt:false, sort:1  },
    { name:'Appliance garage',           price:0,  perFt:false, sort:2  },
    { name:'Blind corner solution',      price:0,  perFt:false, sort:3  },
    { name:'Double garbage pullout',     price:0,  perFt:false, sort:4  },
    { name:'Toe kick drawers',           price:0,  perFt:false, sort:5  },
    { name:'Lazy Susan',                 price:0,  perFt:false, sort:6  },
    { name:'Wine rack / cabinet',        price:0,  perFt:false, sort:7  },
    { name:'Spice rack',                 price:0,  perFt:false, sort:8  },
    { name:'Pull-out shelves',           price:0,  perFt:false, sort:9  },
    { name:'Pot drawers',                price:0,  perFt:false, sort:10 },
    { name:'Pantry unit',                price:0,  perFt:false, sort:11 },
    { name:'Desk / homework station',    price:0,  perFt:false, sort:12 },
    { name:'Glass door fronts',          price:0,  perFt:false, sort:13 },
    { name:'Undervalence lighting rail', price:0,  perFt:true,  sort:14 },
    { name:'Crown moulding',             price:0,  perFt:true,  sort:15 },
  ];

  async function ensureSpecialtyDefaults(shopRecord) {
    const shopName = shopRecord.fields['Shop name'];
    const existing = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    if (existing.length > 0) return existing;
    // New shop — create default list
    const created = [];
    for (const item of DEFAULT_SPECIALTY_ITEMS) {
      try {
        const rec = await atCreate(CONFIG.SPECIALTY_TABLE, {
          'Shop': [shopRecord.id],
          'Item name': item.name,
          'Special Items': item.name,
          'Price': item.price,
          'Per linear foot': item.perFt,
          'Active': true,
          'Sort order': item.sort,
        });
        if (rec?.id) created.push(rec);
      } catch(e) { console.warn('Failed to create default specialty item:', item.name, e); }
    }
    return created.sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  // ============================================================
  // POPULATE FIELDS
  // ============================================================
  function populateShop(shop) {
    const f = shop.fields;
    const set = (id, val) => { const e = el(id); if (e) e.value = val || ''; };
    set('mq-shop-name', f['Shop name']);
    set('mq-shop-phone', f['Phone']);
    set('mq-shop-city', f['City']);
    set('mq-shop-website', f['Website']);
    set('mq-shop-email', f['Lead notify email']);
    set('mq-shop-color', f['Brand colour']);
    set('mq-shop-range-low',  f['Quote range low']  || '10');
    set('mq-shop-range-high', f['Quote range high'] || '15');
    set('mq-shop-logo', f['Logo URL']);
    set('mq-shop-disclaimer', f['Disclaimer text']);
    set('mq-shop-consult-link', f['Consultation link']);
    set('mq-shop-consult-email', f['Consultation email']);
    const toggle = el('mq-showroom-toggle');
    if (toggle) {
      const isOn = f['Show showroom'] !== false;
      toggle.classList.toggle('on', isOn);
    }
  }

  function populatePricing(pricing) {
    if (!pricing) return;
    const f = pricing.fields;
    const set = (id, val) => { const e = el(id); if (e && val !== undefined) e.value = val; };
    set('mq-p-melamine', f['Melamine price']);
    set('mq-p-plywood', f['Plywood price']);
    set('mq-p-mdf', f['MDF price']);
    set('mq-p-solid', f['Solid wood price']);
    set('mq-p-slab', f['Slab multiplier']);
    set('mq-p-shaker', f['Shaker multiplier']);
    set('mq-p-raised', f['Raised multiplier']);
    set('mq-p-glass', f['Glass multiplier']);
    set('mq-p-install', f['Install rate uppers']);
    set('mq-p-hinges', f['Soft close hinges']);
    set('mq-p-drawer', f['Birch drawer box']);
    set('mq-p-removal', f['Removal rate']);
    set('mq-p-lam', f['Lam supply']);
    set('mq-p-ss-econ', f['SS econ supply']);
    set('mq-p-ss-mid', f['SS mid supply']);
    set('mq-p-ss-prem', f['SS prem supply']);
    set('mq-p-gran-econ', f['Gran econ supply']);
    set('mq-p-gran-mid', f['Gran mid supply']);
    set('mq-p-gran-prem', f['Gran prem supply']);
    set('mq-p-quartz', f['Quartz supply']);
    set('mq-p-marble', f['Marble supply']);
    set('mq-p-butcher', f['Butcher supply']);
    set('mq-p-zone-radius', f['Local zone radius']);
    set('mq-p-zone2', f['Zone 2 surcharge']);
    set('mq-p-zone3', f['Zone 3 surcharge']);
    set('mq-p-zone4', f['Zone 4 surcharge']);
    set('mq-p-tax', f['Tax rate']);
    set('mq-p-backsplash', f['Backsplash rate']);
    set('mq-p-sink', f['Sink cutout']);
    set('mq-p-cooktop', f['Cooktop cutout']);
  }

  function renderLeads(leads, limit) {
    if (!leads.length) return '<div class="mq-empty">No leads yet — share your widget to start capturing quotes!</div>';
    const rows = (limit ? leads.slice(0, limit) : leads).map(r => {
      const f = r.fields;
      const statusColors = { New: 'blue', Contacted: 'yellow', Booked: 'green', Lost: 'red' };
      const color = statusColors[f['Status']] || 'grey';
      return `<tr>
        <td><strong>${f['Customer name'] || '—'}</strong></td>
        <td>${f['Customer email'] || '—'}</td>
        <td>${f['Customer phone'] || '—'}</td>
        <td>${f['Quote type'] || '—'}</td>
        <td>${f['Estimate low'] ? fmt(f['Estimate low']) + ' – ' + fmt(f['Estimate high']) : '—'}</td>
        <td><span class="mq-badge mq-badge-${color}">${f['Status'] || 'New'}</span></td>
        <td>
          <select onchange="mqUpdateLeadStatus('${r.id}', this.value)" style="font-size:11px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-family:inherit">
            <option ${f['Status']==='New'?'selected':''}>New</option>
            <option ${f['Status']==='Contacted'?'selected':''}>Contacted</option>
            <option ${f['Status']==='Booked'?'selected':''}>Booked</option>
            <option ${f['Status']==='Lost'?'selected':''}>Lost</option>
          </select>
        </td>
        <td><button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteLead('${r.id}')">Delete</button></td>
      </tr>`;
    }).join('');
    return `<div class="mq-table-wrap"><table class="mq-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Estimate</th><th>Status</th><th>Update</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderStats(leads) {
    const total = leads.length;
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newThisWeek = leads.filter(r => new Date(r.fields['Created'] || r.createdTime) > oneWeekAgo).length;
    const booked = leads.filter(r => r.fields['Status'] === 'Booked').length;
    const pipeline = leads.reduce((sum, r) => sum + (r.fields['Estimate high'] || 0), 0);
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
    set('mq-stat-leads', total);
    set('mq-stat-new', newThisWeek);
    set('mq-stat-booked', booked);
    set('mq-stat-value', fmt(pipeline));
  }

  function renderSpecialty(specs, shopRecord) {
    const container = el('mq-spec-list');
    if (!container) return;
    if (!specs.length) {
      container.innerHTML = '<div class="mq-empty" style="padding:2rem">No specialty items yet. Click "+ Add item" to add your first one.</div>';
      return;
    }
    container.innerHTML = `
      <div class="mq-table-wrap">
      <table class="mq-table" id="mq-spec-table">
        <thead><tr><th></th><th>Item name</th><th>Price</th><th>Per lin ft?</th><th>Active</th><th></th></tr></thead>
        <tbody id="mq-spec-tbody">
          ${specs.map(r => `
            <tr data-id="${r.id}" style="cursor:grab">
              <td style="color:#9ca3af;font-size:16px;padding:8px 12px">⠿</td>
              <td><input type="text" value="${r.fields['Item name'] || ''}" id="mq-spec-name-${r.id}" style="border:none;background:none;font-size:13px;width:160px" onblur="mqSaveSpecField('${r.id}','Item name',this.value)"/></td>
              <td><input type="number" value="${r.fields['Price'] || ''}" id="mq-spec-price-${r.id}" style="width:80px" onblur="mqSaveSpecField('${r.id}','Price',parseFloat(this.value))"/></td>
              <td><input type="checkbox" ${r.fields['Per linear foot']?'checked':''} onchange="mqSaveSpecField('${r.id}','Per linear foot',this.checked)"/></td>
              <td><input type="checkbox" ${r.fields['Active']?'checked':''} onchange="mqSaveSpecField('${r.id}','Active',this.checked)"/></td>
              <td><button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteSpec('${r.id}')">Delete</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>`;

    const tbody = document.getElementById('mq-spec-tbody');
    let dragging = null;

    tbody.querySelectorAll('tr').forEach(row => {
      row.draggable = true;
      row.addEventListener('dragstart', () => {
        dragging = row;
        setTimeout(() => row.style.opacity = '0.4', 0);
      });
      row.addEventListener('dragend', async () => {
        row.style.opacity = '1';
        dragging = null;
        const rows = [...tbody.querySelectorAll('tr')];
        for (let i = 0; i < rows.length; i++) {
          await atUpdate(CONFIG.SPECIALTY_TABLE, rows[i].dataset.id, { 'Sort order': i + 1 });
        }
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const after = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        if (e.clientY < after) {
          tbody.insertBefore(dragging, row);
        } else {
          tbody.insertBefore(dragging, row.nextSibling);
        }
      });
    });
  }

  // ============================================================
  // SAVE FUNCTIONS
  // ============================================================
  window.mqToggleShowroom = function() {
    const toggle = el('mq-showroom-toggle');
    if (!toggle) return;
    toggle.classList.toggle('on');
    const isOn = toggle.classList.contains('on');
    const shopRec = window._mqShopRecord;
    if (shopRec) {
      atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Show showroom': isOn });
      shopRec.fields['Show showroom'] = isOn;
    }
  };

  window.mqSaveShop = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      const updatedFields = {
        'Shop name':         gv('mq-shop-name'),
        'Phone':             gv('mq-shop-phone'),
        'City':              gv('mq-shop-city'),
        'Website':           gv('mq-shop-website'),
        'Lead notify email': gv('mq-shop-email'),
        'Brand colour':      gv('mq-shop-color'),
        'Quote range low':   gn('mq-shop-range-low',  10),
        'Quote range high':  gn('mq-shop-range-high', 15),
        'Logo URL':          gv('mq-shop-logo'),
        'Disclaimer text':   gv('mq-shop-disclaimer'),
        'Consultation link': gv('mq-shop-consult-link'),
        'Consultation email': gv('mq-shop-consult-email'),
      };
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, updatedFields);
      // Keep the in-memory record in sync so other tabs (like Marketing Kit) reflect changes immediately
      Object.assign(shopRec.fields, updatedFields);
      // If Marketing Kit has already been opened this session, force it to rebuild with fresh data
      const socialEl = document.getElementById('mq-mk-social');
      if (socialEl) {
        socialEl.dataset.loaded = '';
        initMarketingKit(shopRec);
      }
      showMsg('mq-shop-msg', '✓ Shop info saved!');
    } catch(e) { showMsg('mq-shop-msg', 'Error saving — please try again.', 'error'); }
  };

  window.mqSavePricing = async function() {
    const pricingRec = window._mqPricingRecord;
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      const fields = {
        'Shop':                [shopRec.id],
        'Melamine price':      gn('mq-p-melamine'),
        'Plywood price':       gn('mq-p-plywood'),
        'MDF price':           gn('mq-p-mdf'),
        'Solid wood price':    gn('mq-p-solid'),
        'Slab multiplier':     gn('mq-p-slab'),
        'Shaker multiplier':   gn('mq-p-shaker'),
        'Raised multiplier':   gn('mq-p-raised'),
        'Glass multiplier':    gn('mq-p-glass'),
        'Install rate uppers': gn('mq-p-install'),
        'Soft close hinges':   gn('mq-p-hinges'),
        'Birch drawer box':    gn('mq-p-drawer'),
        'Removal rate':        gn('mq-p-removal'),
        'Lam supply':          gn('mq-p-lam'),
        'SS econ supply':      gn('mq-p-ss-econ'),
        'SS mid supply':       gn('mq-p-ss-mid'),
        'SS prem supply':      gn('mq-p-ss-prem'),
        'Gran econ supply':    gn('mq-p-gran-econ'),
        'Gran mid supply':     gn('mq-p-gran-mid'),
        'Gran prem supply':    gn('mq-p-gran-prem'),
        'Quartz supply':       gn('mq-p-quartz'),
        'Marble supply':       gn('mq-p-marble'),
        'Butcher supply':      gn('mq-p-butcher'),
        'Local zone radius':   gn('mq-p-zone-radius'),
        'Zone 2 surcharge':    gn('mq-p-zone2'),
        'Zone 3 surcharge':    gn('mq-p-zone3'),
        'Zone 4 surcharge':    gn('mq-p-zone4'),
        'Tax rate':            gn('mq-p-tax'),
        'Backsplash rate':     gn('mq-p-backsplash'),
        'Sink cutout':         gn('mq-p-sink'),
        'Cooktop cutout':      gn('mq-p-cooktop'),
      };
      if (pricingRec) {
        await atUpdate(CONFIG.PRICING_TABLE, pricingRec.id, fields);
      } else {
        const newRec = await atCreate(CONFIG.PRICING_TABLE, fields);
        window._mqPricingRecord = newRec;
      }
      showMsg('mq-pricing-msg', '✓ Pricing saved!');
    } catch(e) { showMsg('mq-pricing-msg', 'Error saving — please try again.', 'error'); }
  };

  const PHOTO_LIBRARY = {
    melamine:  { label:'Melamine',                emoji:'🟤', desc:'Durable, easy-clean surface over engineered wood. Budget-friendly and available in dozens of colours.' },
    plywood:   { label:'Plywood',                 emoji:'🪵', desc:'Superior moisture resistance and structural strength. A premium choice for long-lasting cabinets.' },
    mdf:       { label:'MDF',                     emoji:'⬜', desc:'Smooth, consistent surface ideal for painted finishes.' },
    solid:     { label:'Solid Wood',              emoji:'🌲', desc:'Real hardwood construction. Beautiful grain, extremely durable, and a timeless choice.' },
    slab:      { label:'Slab Door',               emoji:'▭',  desc:'Clean, flat door with no frame. The defining look of modern and minimalist kitchens.' },
    shaker:    { label:'Shaker Door',             emoji:'⬜', desc:'Five-piece frame with a flat centre panel. The most popular style — timeless and versatile.' },
    raised:    { label:'Raised Panel Door',       emoji:'🔲', desc:'Traditional raised centre panel. Adds depth and a classic, formal look.' },
    glass:     { label:'Glass Front Door',        emoji:'🪟', desc:'Perfect for displaying dishes or adding visual lightness. Clear, frosted, or textured.' },
    none:      { label:'No Doors',                emoji:'📦', desc:'Open shelving or frameless box only. Popular for pantry areas and modern designs.' },
    lam:       { label:'Laminate',                emoji:'🟫', desc:'Most affordable option. Hundreds of colours and patterns including realistic stone looks.' },
    ss_econ:   { label:'Solid Surface — Economy', emoji:'⬜', desc:'Non-porous, seamless surface that resists stains. Can be repaired if scratched.' },
    ss_mid:    { label:'Solid Surface — Mid',     emoji:'⬜', desc:'Premium solid surface with better colour depth and durability.' },
    ss_prem:   { label:'Solid Surface — Premium', emoji:'⬜', desc:'Top-tier solid surface with designer colour options and superior finish quality.' },
    gran_econ: { label:'Granite — Economy',       emoji:'🪨', desc:'Natural stone with unique veining and excellent heat resistance. Great value.' },
    gran_mid:  { label:'Granite — Mid',           emoji:'🪨', desc:'More consistent patterning and colour selection. Extremely durable.' },
    gran_prem: { label:'Granite — Premium',       emoji:'🪨', desc:'Exceptional colour, movement, and rarity. Each slab is unique.' },
    quartz:    { label:'Quartz',                  emoji:'💎', desc:'Engineered stone — non-porous, consistent colouring, very low maintenance.' },
    marble:    { label:'Marble',                  emoji:'🤍', desc:'The ultimate luxury surface. Beautiful natural veining unique to every slab.' },
    butcher:   { label:'Butcher Block',           emoji:'🟤', desc:'Warm, natural wood surface. Ideal for islands. Can be sanded and refinished.' },
  };

  // MidasQuote curated photo library — swap placeholder URLs for real photos when ready
  // Format: { category: [ {url, label}, ... ] }
  // GitHub photo library — reads directly from repo folders, no manifest needed
  // Folder structure: photos/materials/, photos/doors/, photos/countertops/, etc.
  const GH_REPO = 'aceswin/midasquote-widget';
  const GH_BASE = `https://raw.githubusercontent.com/${GH_REPO}/main`;
  const GH_API  = `https://api.github.com/repos/${GH_REPO}/contents`;

  // Map line item categories to photo folder names
  const CAT_TO_FOLDER = {
    material:   'materials',
    door:       'doors',
    drawer:     'drawers',
    hinge:      'hinges',
    countertop: 'countertops',
    specialty:  'specialty',
  };

  const _photoCache = {};

  async function fetchPhotoFolder(cat) {
    const folder = CAT_TO_FOLDER[cat] || cat;
    if (_photoCache[folder]) return _photoCache[folder];
    try {
      const res = await fetch(`${GH_API}/${folder}`);
      if (!res.ok) { _photoCache[folder] = []; return []; }
      const files = await res.json();
      const photos = files
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
        .map(f => ({
          url:   `${GH_BASE}/${folder}/${f.name}`,
          label: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }));
      _photoCache[folder] = photos;
      return photos;
    } catch(e) { _photoCache[folder] = []; return []; }
  }

  // Photo picker modal
  function injectPhotoPicker() {
    if (document.getElementById('mq-photo-picker')) return;
    const modal = document.createElement('div');
    modal.id = 'mq-photo-picker';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:100%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div style="font-size:15px;font-weight:600;color:#111">📷 Choose from library</div>
          <button onclick="mqClosePhotoPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1">×</button>
        </div>
        <div id="mq-picker-grid" style="padding:1rem;overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px"></div>
        <div style="padding:0.75rem 1rem;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;flex-shrink:0">
          Don't see what you're looking for? You can also paste a photo URL directly.
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  let _pickerTargetKey = null;

  window.mqOpenPhotoPicker = async function(key, cat) {
    injectPhotoPicker();
    _pickerTargetKey = key;
    const grid = document.getElementById('mq-picker-grid');
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#9ca3af;font-size:13px">Loading photos...</div>';
    document.getElementById('mq-photo-picker').style.display = 'flex';

    const photos = await fetchPhotoFolder(cat);

    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#9ca3af;font-size:13px">
        No library photos available for this category yet.<br>
        No worries — just paste your own photo URL above instead.
      </div>`;
      return;
    }

    grid.innerHTML = photos.map(p => `
      <div onclick="mqSelectLibraryPhoto('${p.url}')"
        style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;transition:all 0.15s"
        onmouseover="this.style.borderColor='#1a1a1a';this.style.transform='scale(1.02)'"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.transform='scale(1)'">
        <img src="${p.url}" style="width:100%;height:100px;object-fit:cover;display:block"
          onerror="this.parentElement.style.display='none'"/>
        <div style="padding:6px 8px;font-size:11px;font-weight:500;color:#374151;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
      </div>`).join('');
  };

  window.mqClosePhotoPicker = function() {
    const m = document.getElementById('mq-photo-picker');
    if (m) m.style.display = 'none';
  };

  window.mqSelectLibraryPhoto = function(url) {
    const input = el('mq-photo-' + _pickerTargetKey);
    if (input) {
      input.value = url;
      mqPreviewPhoto(_pickerTargetKey);
    }
    mqClosePhotoPicker();
  };

  function buildProductCard(key, savedPhotos) {
    const lib = PHOTO_LIBRARY[key];
    if (!lib) return '';
    const savedUrl = (savedPhotos && savedPhotos[key]) || '';
    const preview = savedUrl
      ? `<img src="${savedUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.style.display='none'"/>`
      : `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${lib.emoji}</div>`;
    return `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem">
        <div id="mq-photo-preview-${key}">${preview}</div>
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${lib.label}</div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:8px;line-height:1.4">${lib.desc}</div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Photo URL (optional)</div>
        <input type="text" id="mq-photo-${key}" value="${savedUrl}" placeholder="https://your-site.com/photo.jpg"
          style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"/>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:4px" onclick="mqPreviewPhoto('${key}')">Preview photo</button>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;color:#6b7280" onclick="mqOpenPhotoPicker('${key}','${key in PHOTO_LIBRARY ? (PHOTO_LIBRARY[key].label||'').toLowerCase() : 'specialty'}')">📷 Choose from library</button>
      </div>`;
  }

  window.mqPreviewPhoto = function(key) {
    const input = el('mq-photo-' + key);
    const preview = el('mq-photo-preview-' + key);
    if (!input || !preview) return;
    const url = input.value.trim();
    if (!url) {
      const lib = PHOTO_LIBRARY[key];
      preview.innerHTML = `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${lib?.emoji||'📷'}</div>`;
      return;
    }
    preview.innerHTML = `<img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.outerHTML='<div style=\\'width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px\\'>📷</div>'"/>`;
  };

  window.mqMarkProductsDirty = function() {
    document.querySelectorAll('.mq-products-save-btn').forEach(btn => {
      btn.textContent = '💾 Save changes';
      btn.style.background = '#16a34a';
      btn.style.borderColor = '#16a34a';
    });
  };

  window.mqSaveProducts = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const photos = {};
    const hidden = {};
    document.querySelectorAll('[id^="mq-photo-"]').forEach(input => {
      if (input.tagName !== 'INPUT') return;
      const key = input.id.replace('mq-photo-', '');
      if (input.value.trim()) photos[key] = input.value.trim();
    });
    document.querySelectorAll('[id^="mq-hidden-"]').forEach(cb => {
      const key = cb.id.replace('mq-hidden-', '');
      if (cb.checked) hidden[key] = true;
    });
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, {
        'Photos':  JSON.stringify(photos),
        'Hidden':  JSON.stringify(hidden),
      });
      shopRec.fields['Photos']  = JSON.stringify(photos);
      shopRec.fields['Hidden']  = JSON.stringify(hidden);
      document.querySelectorAll('.mq-products-save-btn').forEach(btn => {
        btn.textContent = 'Saved ✓';
        btn.style.background = '#1a1a1a';
        btn.style.borderColor = '#1a1a1a';
        setTimeout(() => { btn.textContent = 'Save photos'; }, 2000);
      });
      showMsg('mq-products-msg', '✓ Photos saved!');
    } catch(e) { showMsg('mq-products-msg', 'Error saving — please try again.', 'error'); }
  };

  async function initProductsTab(shopRecord, lineItemsData) {
    const token = shopRecord.fields['Shop token'] || '';
    const showroomUrl = `https://widget.midasquote.com/showroom.html?shop=${token}`;

    let savedPhotos = {};
    let savedProducts = {};
    try { if (shopRecord.fields['Photos']) savedPhotos = JSON.parse(shopRecord.fields['Photos']); } catch(e) {}
    try { if (shopRecord.fields['Products']) savedProducts = JSON.parse(shopRecord.fields['Products']); } catch(e) {}

    // Categories to exclude from My Products (no photos needed)
    const EXCLUDED_CATS = new Set(['install','zone','tax','removal','backsplash','cutout','other','hinge']);

    // Group line items by category directly — same source as pricing helper
    const byCategory = {};
    (lineItemsData || []).forEach(r => {
      if (!r.fields || r.fields['Active'] === false) return;
      const cat = r.fields['Category'];
      if (!cat || EXCLUDED_CATS.has(cat.toLowerCase())) return;
      if (!byCategory[cat]) byCategory[cat] = [];
      // Deduplicate by base name (strip "— uppers"/"— bases" suffix)
      const ITEM_EXCLUDE = /backsplash|cutout|cooktop/i;
      const baseName = (r.fields['Name'] || '').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i,'').trim();
      if (ITEM_EXCLUDE.test(baseName)) return;
      if (!byCategory[cat].find(x => x.baseName === baseName)) {
        byCategory[cat].push({ id: r.id, baseName, fullName: r.fields['Name'] || baseName });
      }
    });

    const CAT_DISPLAY = {
      material: { title:'🪵 Box Materials',       emoji:'🪵' },
      door:     { title:'🚪 Door Styles',          emoji:'🚪' },
      drawer:   { title:'🗄️ Drawer Configurations', emoji:'🗄️' },
      hinge:    { title:'🔧 Door Hinges',          emoji:'🔧' },
      countertop:{ title:'🪨 Countertop Materials', emoji:'🪨' },
    };

    // Build Products for showroom — all item names per category
    const savedProductsForShowroom = {};
    Object.entries(byCategory).forEach(([cat, items]) => {
      savedProductsForShowroom[cat] = items.map(i => i.baseName);
    });


    // Save detected keys so showroom can read them
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Products': JSON.stringify(savedProductsForShowroom) });
      shopRecord.fields['Products'] = JSON.stringify(savedProductsForShowroom);
    } catch(e) {}

    // Load specialty items
    const specItems = await atGet(CONFIG.SPECIALTY_TABLE, `AND(FIND("${shopRecord.fields['Shop name']}", ARRAYJOIN({Shop})), {Active})`);

    const icons = {'tall':'📦','appliance':'🔌','blind':'↩️','garbage':'🗑️','toe':'👟','lazy':'🔄','wine':'🍷','spice':'🧂','pull':'📥','pot':'🍳','pantry':'🥫','desk':'🖥️','glass':'🪟','light':'💡','crown':'👑'};
    function specIcon(name) { for (const [k,v] of Object.entries(icons)) { if ((name||'').toLowerCase().includes(k)) return v; } return '⭐'; }

    let savedHidden = {};
    try { if (shopRecord.fields['Hidden']) savedHidden = JSON.parse(shopRecord.fields['Hidden']); } catch(e) {}

    function photoCard(key, name, emoji, cat) {
      const savedUrl = savedPhotos[key] || '';
      const isHidden = savedHidden[key] || false;
      const preview = savedUrl
        ? `<img src="${savedUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:100%;height:120px;background:#f0efeb;border-radius:8px;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`
        : `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`;
      return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;${isHidden ? 'opacity:0.5' : ''}">
        <div id="mq-photo-preview-${key}">${preview}</div>
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${name}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" id="mq-hidden-${key}" ${isHidden ? 'checked' : ''} style="width:auto"
            onchange="mqMarkProductsDirty();this.closest('div[style*=border-radius]').style.opacity=this.checked?'0.5':'1'"/>
          Hide from showroom
        </label>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Photo URL (optional)</div>
        <input type="text" id="mq-photo-${key}" value="${savedUrl}" placeholder="https://your-site.com/photo.jpg"
          style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"
          oninput="mqMarkProductsDirty()"/>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:4px" onclick="mqPreviewPhoto('${key}')">Preview photo</button>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;color:#6b7280" onclick="mqOpenPhotoPicker('${key}','${cat||'specialty'}')">📷 Choose from library</button>
      </div>`;
    }

    function catSection(cat) {
      const items = byCategory[cat] || [];
      if (!items.length) return '';
      const disp = CAT_DISPLAY[cat] || { title: cat, emoji: '📦' };
      const cards = items.map(item => {
        const key = `li_${cat}_${item.baseName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`;
        const lib = PHOTO_LIBRARY[item.baseName.toLowerCase().replace(/\s+/g,'_')] || {};
        return photoCard(key, item.baseName, lib.emoji || disp.emoji, cat);
      }).join('');
      return `<div class="mq-card">
        <div class="mq-card-title">${disp.title}</div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add a photo URL for each item — leave blank to show the default icon on your showroom page.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">${cards}</div>
        <button class="mq-btn mq-btn-primary mq-products-save-btn" style="margin-top:1rem;width:100%" onclick="mqSaveProducts()">Save photos</button>
      </div>`;
    }

    const specSection = specItems.length ? `<div class="mq-card">
      <div class="mq-card-title">⭐ Specialty Items</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add photos to your specialty items. All active items from your Specialty Items tab appear here.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">
        ${specItems.map(r => photoCard('spec_' + r.id, r.fields['Item name'] || '', specIcon(r.fields['Item name']), 'specialty')).join('')}
      </div>
      <button class="mq-btn mq-btn-primary mq-products-save-btn" style="margin-top:1rem;width:100%" onclick="mqSaveProducts()">Save photos</button>
    </div>` : '';

    const content = el('mq-products-content');
    if (content) {
      const catsOrdered = ['material','door','drawer','hinge','countertop'];
      const hasCats = catsOrdered.some(c => byCategory[c]?.length);
      content.innerHTML = (!hasCats && !specItems.length)
        ? '<div class="mq-empty">Set up your pricing first — your configured items will appear here automatically.</div>'
        : catsOrdered.map(catSection).join('') + specSection;
    }

    const linkText = el('mq-showroom-link-text');
    const copyBtn  = el('mq-showroom-copy-btn');
    const openBtn  = el('mq-showroom-open-btn');
    if (linkText) linkText.textContent = showroomUrl;
    if (copyBtn)  copyBtn.onclick = () => mqCopyText(showroomUrl, copyBtn);
    if (openBtn)  openBtn.onclick = () => window.open(showroomUrl, '_blank');
  }
  window.mqToggleShowroom = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const toggle = el('mq-showroom-toggle');
    const isOn = toggle.classList.contains('on');
    toggle.classList.toggle('on', !isOn);
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Show showroom': !isOn });
      shopRec.fields['Show showroom'] = !isOn;
      showMsg('mq-products-msg', !isOn ? '✓ Showroom link enabled on widget.' : '✓ Showroom link hidden from widget.');
    } catch(e) { toggle.classList.toggle('on', isOn); showMsg('mq-products-msg', 'Error saving.', 'error'); }
  };

  window.mqUpdateLeadStatus = async function(id, status) {
    try {
      await atUpdate(CONFIG.LEADS_TABLE, id, { 'Status': status });
    } catch(e) { console.error('Failed to update lead status', e); }
  };

  window.mqSaveAllSpecItems = async function() {
    const rows = document.querySelectorAll('#mq-spec-tbody tr[data-id]');
    if (!rows.length) return;
    showMsg('mq-spec-msg', 'Saving...');
    try {
      for (const row of rows) {
        const id = row.dataset.id;
        const nameInput = document.getElementById('mq-spec-name-' + id);
        const priceInput = document.getElementById('mq-spec-price-' + id);
        if (nameInput || priceInput) {
          await atUpdate(CONFIG.SPECIALTY_TABLE, id, {
            'Item name': nameInput?.value || '',
            'Price': parseFloat(priceInput?.value) || 0,
          });
        }
      }
      showMsg('mq-spec-msg', '✓ All items saved!');
    } catch(e) { showMsg('mq-spec-msg', 'Error saving — please try again.', 'error'); }
  };

  window.mqSaveSpecField = async function(id, field, value) {
    try {
      await atUpdate(CONFIG.SPECIALTY_TABLE, id, { [field]: value });
    } catch(e) { console.error('Failed to save specialty field', e); }
  };

  window.mqDeleteSpec = async function(id) {
    if (!confirm('Delete this specialty item?')) return;
    try {
      await atDelete(CONFIG.SPECIALTY_TABLE, id);
      const specs = await loadSpecialty(window._mqShopRecord.fields['Shop name']);
      renderSpecialty(specs, window._mqShopRecord);
      showMsg('mq-spec-msg', '✓ Item deleted.');
    } catch(e) { showMsg('mq-spec-msg', 'Error deleting item.', 'error'); }
  };

  window.mqAddSpecItem = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      await atCreate(CONFIG.SPECIALTY_TABLE, {
        'Item name': 'New item',
        'Shop': [shopRec.id],
        'Price': 0,
        'Active': true,
        'Per linear foot': false,
        'Sort order': 0,
      });
      const specs = await loadSpecialty(shopRec.fields['Shop name']);
      renderSpecialty(specs, shopRec);
      showMsg('mq-spec-msg', '✓ Item added — edit the name and price above.');
    } catch(e) { showMsg('mq-spec-msg', 'Error adding item.', 'error'); }
  };

  window.mqDeleteLead = async function(id) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await atDelete(CONFIG.LEADS_TABLE, id);
      window._mqLeads = window._mqLeads.filter(r => r.id !== id);
      renderStats(window._mqLeads);
      el('mq-recent-leads').innerHTML = renderLeads(window._mqLeads, 5);
      mqFilterLeads();
      showMsg('mq-leads-msg', '✓ Lead deleted.');
    } catch(e) { showMsg('mq-leads-msg', 'Error deleting lead.', 'error'); }
  };

  window.mqDeleteAllLeads = async function() {
    const count = window._mqLeads?.length || 0;
    if (count === 0) return;
    if (!confirm(`Delete ALL ${count} leads? This is useful for clearing test data but cannot be undone. Are you sure?`)) return;
    if (!confirm(`Really delete all ${count} leads? Last chance to cancel.`)) return;
    try {
      for (const lead of window._mqLeads) {
        await atDelete(CONFIG.LEADS_TABLE, lead.id);
      }
      window._mqLeads = [];
      renderStats([]);
      el('mq-recent-leads').innerHTML = renderLeads([], 5);
      mqFilterLeads();
      showMsg('mq-leads-msg', '✓ All leads deleted.');
    } catch(e) { showMsg('mq-leads-msg', 'Error deleting leads.', 'error'); }
  };

  // ============================================================
  // MY PRODUCTS
  // ============================================================


  window.mqFilterLeads = async function() {
    const filter = gv('mq-lead-filter');
    let leads = window._mqLeads || [];
    if (filter) leads = leads.filter(r => r.fields['Status'] === filter);
    el('mq-leads-table').innerHTML = renderLeads(leads);
  };

  // ============================================================
  // MARKETING KIT
  // ============================================================
  // Persisted across re-renders so re-opening or refreshing Marketing Kit doesn't lose an uploaded background photo
  let _mqGraphicBgImage = null;
  let _mqGraphicOverlayOpacity = 0.62;
  let _mqCustomPostLink = '';
  let _mqQrBgImage = null;
  let _mqQrOverlayOpacity = 0.62;
  let _mqQrLibLoading = null;

  function initMarketingKit(shopRecord) {
    const shopName = shopRecord.fields['Shop name'] || 'our shop';
    const token = shopRecord.fields['Shop token'] || '';
    const defaultQuoteLink = `https://widget.midasquote.com/?shop=${token}`;
    const embedCode = `<div style="text-align:center">\n  <div id="midasquote-widget"></div>\n  <script src="https://widget.midasquote.com/widget.js?shop=${token}"></script>\n</div>`;

    function buildSocialPosts(quoteLink) {
      return [
        `🛠️ Now you can get an instant cabinet quote right from our website! No phone calls, no waiting around — just answer a few quick questions and get your ballpark price in under 2 minutes. Try it now → ${quoteLink}`,
        `Tired of waiting days for a quote? We just made it instant. ⚡ Get a real price range on your kitchen project in 60 seconds — right from your phone. ${quoteLink}`,
        `We just upgraded how we quote projects. Instead of waiting for a callback, you can now get an instant estimate online — anytime, day or night. Give it a try: ${quoteLink}`,
        `Know your price before you even call. Get an instant cabinet estimate here → ${quoteLink}`,
        `Hey homeowners! If you're planning a kitchen remodel, we just made getting a price way easier. Try our new instant quote tool — no obligation, just real numbers: ${quoteLink}`,
      ];
    }

    const quoteLink = _mqCustomPostLink || defaultQuoteLink;
    const socialPosts = buildSocialPosts(quoteLink);

    const headlines = [
      'Get a free quote online in minutes',
      'Know your price before you even call',
      'Get your cabinet estimate in under 2 minutes',
      'No phone calls. No waiting. Just your price.',
      'See what your project costs — right now',
    ];

    const dmTemplate = `Hi [Name]! Just wanted to let you know ${shopName} now has an instant online quote tool if you ever want a quick ballpark on a future project — no need to wait for a callback. Here's the link if you ever want to check it out: ${quoteLink}`;

    const heroHeaderHTML = `<div style="text-align:center;padding:2rem 1rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#b8763a;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
    Instant Pricing
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
  </div>
  <h2 style="font-size:28px;font-weight:600;color:#1a1a1a;line-height:1.2;margin:0 0 0.75rem">Get your cabinet estimate<br/>in under 2 minutes</h2>
  <p style="font-size:14px;color:#6b7280;line-height:1.7;max-width:460px;margin:0 auto">No phone tag, no awkward sales call. Fill in a few details and we'll send you a ballpark range you can actually plan around.</p>
</div>`;

    const trustBarHTML = `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.5rem;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin:30px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">✅</span><span>No commitment required</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">📧</span><span>Results sent to your inbox</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">🔒</span><span>We never sell your info</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">⚡</span><span>Instant ballpark estimate</span></div>
</div>`;

    const escapeHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const socialEl = el('mq-mk-social');
    function renderSocialPosts(posts) {
      if (!socialEl) return;
      socialEl.innerHTML = posts.map((post, i) => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(post)}</div>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(post)},this)">Copy</button>
        </div>`).join('');
    }
    renderSocialPosts(socialPosts);

    const postLinkInput = el('mq-mk-post-link');
    const postLinkApplyBtn = el('mq-mk-post-link-apply');
    if (postLinkInput) postLinkInput.value = _mqCustomPostLink;
    if (postLinkApplyBtn) {
      postLinkApplyBtn.onclick = () => {
        const val = (postLinkInput?.value || '').trim();
        _mqCustomPostLink = val;
        const newLink = val || defaultQuoteLink;
        renderSocialPosts(buildSocialPosts(newLink));
        if (typeof window._mqRedrawQrPoster === 'function') window._mqRedrawQrPoster();
        postLinkApplyBtn.textContent = 'Applied ✓';
        setTimeout(() => { postLinkApplyBtn.textContent = 'Apply'; }, 1500);
      };
    }

    const headlinesEl = el('mq-mk-headlines');
    if (headlinesEl) {
      headlinesEl.innerHTML = headlines.map(h => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-size:13px;color:#111">${escapeHtml(h)}</span>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(h)},this)">Copy</button>
        </div>`).join('');
    }

    const dmEl = el('mq-mk-dm');
    if (dmEl) {
      dmEl.innerHTML = `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(dmTemplate)}</div>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(dmTemplate)},this)">Copy</button>
        </div>`;
    }

    const headerDisplay = el('mq-mk-header-display');
    const headerCopyBtn = el('mq-mk-header-copy');
    const headerPreview = el('mq-mk-header-preview');
    if (headerDisplay) headerDisplay.textContent = heroHeaderHTML;
    if (headerCopyBtn) headerCopyBtn.onclick = () => mqCopyText(heroHeaderHTML, headerCopyBtn);
    if (headerPreview) headerPreview.innerHTML = heroHeaderHTML;

    const trustDisplay = el('mq-mk-trustbar-display');
    const trustCopyBtn = el('mq-mk-trustbar-copy');
    const trustPreview = el('mq-mk-trustbar-preview');
    if (trustDisplay) trustDisplay.textContent = trustBarHTML;
    if (trustCopyBtn) trustCopyBtn.onclick = () => mqCopyText(trustBarHTML, trustCopyBtn);
    if (trustPreview) trustPreview.innerHTML = trustBarHTML;

    // Social graphic — drawn on canvas, downloadable as PNG
    const canvas = el('mq-mk-canvas');
    const downloadBtn = el('mq-mk-download-btn');
    const bgPhotoInput = el('mq-mk-bg-photo');
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const brandColor = shopRecord.fields['Brand colour'] || '#1a1a1a';
      const city = shopRecord.fields['City'] || '';
      const accentColor = (() => {
        try {
          const hex = brandColor.replace('#','');
          const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
          const lighten = (c) => Math.min(255, Math.round(c + (255 - c) * 0.45));
          return `rgb(${lighten(r)},${lighten(g)},${lighten(b)})`;
        } catch(e) { return '#d4a574'; }
      })();

      let bgImage = _mqGraphicBgImage;
      let overlayOpacity = _mqGraphicOverlayOpacity;

      function wrapText(text, font, maxWidth) {
        ctx.font = font;
        const words = text.split(' ');
        const lines = [];
        let line = '';
        words.forEach(word => {
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        });
        if (line) lines.push(line);
        return lines;
      }

      function drawGraphic() {
        ctx.clearRect(0,0,W,H);

        // Background — photo (cover-fit + dark overlay) or solid
        if (bgImage) {
          const imgRatio = bgImage.width / bgImage.height;
          const canvasRatio = W / H;
          let dw, dh, dx, dy;
          if (imgRatio > canvasRatio) {
            dh = H; dw = H * imgRatio; dx = (W - dw) / 2; dy = 0;
          } else {
            dw = W; dh = W / imgRatio; dx = 0; dy = (H - dh) / 2;
          }
          ctx.drawImage(bgImage, dx, dy, dw, dh);
          ctx.fillStyle = `rgba(10,10,10,${overlayOpacity})`;
          ctx.fillRect(0,0,W,H);
        } else {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0,0,W,H);
        }

        const pad = 90;

        // Logo chip + shop name
        const chipSize = 100;
        ctx.fillStyle = brandColor;
        ctx.beginPath();
        ctx.roundRect(pad, pad, chipSize, chipSize, 24);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '500 50px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', pad + chipSize/2, pad + chipSize/2 + 4);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 44px -apple-system, sans-serif';
        ctx.fillText(shopName, pad + chipSize + 28, pad + chipSize/2 - 4);
        if (city) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '400 30px -apple-system, sans-serif';
          ctx.fillText(city, pad + chipSize + 28, pad + chipSize/2 + 36);
        }

        // Eyebrow
        let y = pad + chipSize + 130;
        ctx.fillStyle = accentColor;
        ctx.font = '600 32px -apple-system, sans-serif';
        ctx.fillText('INSTANT PRICING', pad, y);

        // Headline
        y += 80;
        const headlineFont = '600 80px -apple-system, sans-serif';
        ctx.font = headlineFont;
        ctx.fillStyle = '#ffffff';
        const headlineLines = wrapText('Get your cabinet quote in under 2 minutes', headlineFont, W - pad*2);
        headlineLines.forEach(line => {
          ctx.font = headlineFont;
          ctx.fillText(line, pad, y);
          y += 92;
        });

        // Subtext
        y += 30;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '400 38px -apple-system, sans-serif';
        ctx.fillText('No phone calls. No waiting. Just your price.', pad, y);

        // Bottom CTA pill — bigger, more prominent
        const ctaH = 116;
        const ctaW = 400;
        const ctaY = H - pad - ctaH;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(pad, ctaY, ctaW, ctaH, 22);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '700 46px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Get a quote →', pad + ctaW/2, ctaY + ctaH/2 + 2);
      }

      drawGraphic();

      const overlayRow = el('mq-mk-overlay-row');
      const overlaySlider = el('mq-mk-overlay-slider');
      const overlayVal = el('mq-mk-overlay-val');

      // If a background photo was already set in a previous render, restore the slider UI to match
      if (bgImage && overlayRow) {
        overlayRow.style.display = 'flex';
        if (overlaySlider) overlaySlider.value = Math.round(overlayOpacity * 100);
        if (overlayVal) overlayVal.textContent = Math.round(overlayOpacity * 100) + '%';
      }

      if (bgPhotoInput) {
        bgPhotoInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              bgImage = img;
              _mqGraphicBgImage = img;
              drawGraphic();
              if (overlayRow) overlayRow.style.display = 'flex';
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        };
      }

      if (overlaySlider) {
        overlaySlider.oninput = () => {
          overlayOpacity = parseInt(overlaySlider.value, 10) / 100;
          _mqGraphicOverlayOpacity = overlayOpacity;
          if (overlayVal) overlayVal.textContent = overlaySlider.value + '%';
          drawGraphic();
        };
      }

      const removeBgBtn = el('mq-mk-bg-remove');
      if (removeBgBtn) {
        removeBgBtn.onclick = () => {
          bgImage = null;
          _mqGraphicBgImage = null;
          if (bgPhotoInput) bgPhotoInput.value = '';
          if (overlayRow) overlayRow.style.display = 'none';
          drawGraphic();
        };
      }

      if (downloadBtn) {
        downloadBtn.onclick = () => {
          const link = document.createElement('a');
          link.download = (shopName.replace(/[^a-z0-9]/gi,'-').toLowerCase() || 'quote-graphic') + '-social-graphic.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        };
      }
    }

    // ── QR POSTER ──
    const qrCanvas = el('mq-mk-qr-canvas');
    if (qrCanvas && qrCanvas.getContext) {
      const qrCtx = qrCanvas.getContext('2d');
      const QW = qrCanvas.width, QH = qrCanvas.height;
      let qrBgImage = _mqQrBgImage;
      let qrOverlayOpacity = _mqQrOverlayOpacity;
      let qrLibState = 'loading'; // 'loading' | 'ready' | 'failed'

      // QR generation library is bundled inline (no external CDN dependency)
      function loadQrLib() {
        if (window.mqQrGen) { qrLibState = 'ready'; return Promise.resolve(); }
        try {
          window.mqQrGen = MQ_QR_LIB_FACTORY();
          qrLibState = 'ready';
        } catch(e) {
          qrLibState = 'failed';
        }
        return Promise.resolve();
      }

      function wrapTextQr(text, font, maxWidth) {
        qrCtx.font = font;
        const words = text.split(' ');
        const lines = [];
        let line = '';
        words.forEach(word => {
          const test = line ? line + ' ' + word : word;
          if (qrCtx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        });
        if (line) lines.push(line);
        return lines;
      }

      function drawPlaceholderCard(qrX, qrY, qrSize, cardPad, lines, subline) {
        qrCtx.fillStyle = '#ffffff';
        qrCtx.beginPath();
        qrCtx.roundRect(qrX - cardPad, qrY - cardPad, qrSize + cardPad*2, qrSize + cardPad*2, 24);
        qrCtx.fill();
        qrCtx.fillStyle = '#6b7280';
        qrCtx.font = '600 36px -apple-system, sans-serif';
        qrCtx.textAlign = 'center';
        qrCtx.textBaseline = 'middle';
        const lineHeight = 44;
        let my = qrY + qrSize/2 - ((lines.length-1) * lineHeight)/2 - (subline ? 16 : 0);
        lines.forEach(line => { qrCtx.fillText(line, qrX + qrSize/2, my); my += lineHeight; });
        if (subline) {
          qrCtx.font = '400 26px -apple-system, sans-serif';
          qrCtx.fillStyle = '#9ca3af';
          const subLines = wrapTextQr(subline, '400 26px -apple-system, sans-serif', qrSize - 70);
          my += 14;
          subLines.forEach(line => { qrCtx.fillText(line, qrX + qrSize/2, my); my += 32; });
        }
        qrCtx.textBaseline = 'alphabetic';
      }

      function drawQrPoster() {
        qrCtx.clearRect(0,0,QW,QH);

        if (qrBgImage) {
          const imgRatio = qrBgImage.width / qrBgImage.height;
          const canvasRatio = QW / QH;
          let dw, dh, dx, dy;
          if (imgRatio > canvasRatio) {
            dh = QH; dw = QH * imgRatio; dx = (QW - dw) / 2; dy = 0;
          } else {
            dw = QW; dh = QW / imgRatio; dx = 0; dy = (QH - dh) / 2;
          }
          qrCtx.drawImage(qrBgImage, dx, dy, dw, dh);
          qrCtx.fillStyle = `rgba(10,10,10,${qrOverlayOpacity})`;
          qrCtx.fillRect(0,0,QW,QH);
        } else {
          qrCtx.fillStyle = '#1a1a1a';
          qrCtx.fillRect(0,0,QW,QH);
        }

        const pad = 90;

        // Shop name top
        qrCtx.textAlign = 'center';
        qrCtx.fillStyle = '#ffffff';
        qrCtx.font = '600 52px -apple-system, sans-serif';
        qrCtx.fillText(shopName, QW/2, pad + 46);

        // Headline — extra gap below shop name
        let y = pad + 150;
        const headlineFont = '600 62px -apple-system, sans-serif';
        const lines = wrapTextQr('Scan for an instant price', headlineFont, QW - pad*2);
        lines.forEach(line => {
          qrCtx.font = headlineFont;
          qrCtx.fillText(line, QW/2, y);
          y += 74;
        });

        // QR code area
        const qrSize = 600;
        const qrX = (QW - qrSize) / 2;
        const qrY = y + 60;
        const cardPad = 36;

        if (!qrLink) {
          drawPlaceholderCard(qrX, qrY, qrSize, cardPad,
            ['No link added yet'],
            'Set your quote page link in "Social media posts" above');
          y = qrY + qrSize + cardPad + 70;
        } else if (qrLibState !== 'ready') {
          drawPlaceholderCard(qrX, qrY, qrSize, cardPad,
            [qrLibState === 'failed' ? 'Couldn\u2019t load QR code' : 'Loading QR code\u2026'],
            qrLibState === 'failed' ? 'Check your connection and reopen this tab' : null);
          y = qrY + qrSize + cardPad + 70;
        } else {
          try {
            const qr = window.mqQrGen(0, 'M');
            qr.addData(qrLink);
            qr.make();
            const count = qr.getModuleCount();
            const cell = qrSize / count;

            qrCtx.fillStyle = '#ffffff';
            qrCtx.beginPath();
            qrCtx.roundRect(qrX - cardPad, qrY - cardPad, qrSize + cardPad*2, qrSize + cardPad*2, 24);
            qrCtx.fill();

            qrCtx.fillStyle = '#1a1a1a';
            for (let row = 0; row < count; row++) {
              for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) {
                  qrCtx.fillRect(qrX + col*cell, qrY + row*cell, cell+0.5, cell+0.5);
                }
              }
            }
            y = qrY + qrSize + cardPad + 70;
          } catch(e) {
            drawPlaceholderCard(qrX, qrY, qrSize, cardPad, ['Couldn\u2019t generate QR code'], null);
            y = qrY + qrSize + cardPad + 70;
          }
        }

        // Subtext
        qrCtx.fillStyle = 'rgba(255,255,255,0.75)';
        qrCtx.font = '400 34px -apple-system, sans-serif';
        qrCtx.fillText('No phone calls. No waiting.', QW/2, y);

        // Bottom CTA button — sexy, prominent
        const ctaH = 110;
        const ctaW = 420;
        const ctaY = QH - pad - ctaH;
        const ctaX = (QW - ctaW) / 2;
        qrCtx.fillStyle = '#ffffff';
        qrCtx.beginPath();
        qrCtx.roundRect(ctaX, ctaY, ctaW, ctaH, 20);
        qrCtx.fill();
        qrCtx.fillStyle = '#1a1a1a';
        qrCtx.font = '700 44px -apple-system, sans-serif';
        qrCtx.textAlign = 'center';
        qrCtx.textBaseline = 'middle';
        qrCtx.fillText('Get a quote →', QW/2, ctaY + ctaH/2 + 2);
        qrCtx.textBaseline = 'alphabetic';
      }

      function getQrLink() {
        return _mqCustomPostLink || '';
      }

      let qrLink = getQrLink();

      window._mqRedrawQrPoster = () => { qrLink = getQrLink(); drawQrPoster(); };

      drawQrPoster();
      loadQrLib().then(() => { qrLink = getQrLink(); drawQrPoster(); });

      const qrBgPhotoInput = el('mq-mk-qr-bg-photo');
      const qrOverlayRow = el('mq-mk-qr-overlay-row');
      const qrOverlaySlider = el('mq-mk-qr-overlay-slider');
      const qrOverlayVal = el('mq-mk-qr-overlay-val');
      const qrDownloadBtn = el('mq-mk-qr-download-btn');
      const qrBgRemoveBtn = el('mq-mk-qr-bg-remove');

      if (qrBgImage && qrOverlayRow) {
        qrOverlayRow.style.display = 'flex';
        if (qrOverlaySlider) qrOverlaySlider.value = Math.round(qrOverlayOpacity * 100);
        if (qrOverlayVal) qrOverlayVal.textContent = Math.round(qrOverlayOpacity * 100) + '%';
      }

      if (qrBgPhotoInput) {
        qrBgPhotoInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              qrBgImage = img;
              _mqQrBgImage = img;
              drawQrPoster();
              if (qrOverlayRow) qrOverlayRow.style.display = 'flex';
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        };
      }

      if (qrOverlaySlider) {
        qrOverlaySlider.oninput = () => {
          qrOverlayOpacity = parseInt(qrOverlaySlider.value, 10) / 100;
          _mqQrOverlayOpacity = qrOverlayOpacity;
          if (qrOverlayVal) qrOverlayVal.textContent = qrOverlaySlider.value + '%';
          drawQrPoster();
        };
      }

      if (qrBgRemoveBtn) {
        qrBgRemoveBtn.onclick = () => {
          qrBgImage = null;
          _mqQrBgImage = null;
          if (qrBgPhotoInput) qrBgPhotoInput.value = '';
          if (qrOverlayRow) qrOverlayRow.style.display = 'none';
          drawQrPoster();
        };
      }

      if (qrDownloadBtn) {
        qrDownloadBtn.onclick = () => {
          if (!qrLink) {
            alert('Please add a link in the "Social media posts" section above first.');
            return;
          }
          const link = document.createElement('a');
          link.download = (shopName.replace(/[^a-z0-9]/gi,'-').toLowerCase() || 'quote-poster') + '-qr-poster.png';
          link.href = qrCanvas.toDataURL('image/png');
          link.click();
        };
      }
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const container = document.getElementById('midasquote-dashboard');
    if (!container) {
      console.error('MidasQuote Dashboard: Add <div id="midasquote-dashboard"></div> to your page.');
      return;
    }

    injectStyles();
    container.innerHTML = '<div class="mq-loading" style="padding:4rem;text-align:center;font-size:14px;color:#6b7280">Loading your dashboard...</div>';

    let shopToken = new URLSearchParams(window.location.search).get('shop');
    if (!shopToken && window.$memberstackDom) {
      try {
        const { data: member } = await window.$memberstackDom.getCurrentMember();
        if (member) shopToken = member.metaData?.shopToken || member.customFields?.shopToken;
      } catch(e) {}
    }
    if (!shopToken) shopToken = 'dr-sales-001';

    const shopRecord = await loadShop(shopToken);
    if (!shopRecord) {
      container.innerHTML = '<div class="mq-loading" style="padding:4rem;text-align:center;color:#dc2626">Shop not found. Please contact support at hello@midasquote.com</div>';
      return;
    }

    window._mqShopRecord = shopRecord;
    container.innerHTML = buildHTML(shopRecord.fields);

    // Tell Memberstack to re-scan the DOM so data-ms-modal attributes work on dynamically injected elements
    if (window.$memberstackDom?.reinitialize) window.$memberstackDom.reinitialize();
    else if (window.MemberStack?.reload) window.MemberStack.reload();

    // Wire up embed copy buttons now that DOM exists
    ['mq-copy-embed-1', 'mq-copy-embed-2'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.onclick = () => mqCopyEmbed(btn);
    });

    const pricingRecord = await loadPricing(shopRecord.fields['Shop name']);
    window._mqPricingRecord = pricingRecord;
    if (pricingRecord) populatePricing(pricingRecord);
    populateShop(shopRecord);

    const leads = await loadLeads(shopRecord.fields['Shop name']);
    window._mqLeads = leads;
    renderStats(leads);
    el('mq-recent-leads').innerHTML = renderLeads(leads, 5);
    el('mq-leads-table').innerHTML = renderLeads(leads);

    const specs = await ensureSpecialtyDefaults(shopRecord);
    renderSpecialty(specs, shopRecord);

    // Load line items for My Products tab
    const lineItems = await atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${shopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`);
    window._mqLineItems = lineItems;
  }

  // Load pricing helper when that nav item is clicked
  const origMqNav = window.mqNav;
  window.mqNav = async function(page, navEl) {
    origMqNav(page, navEl);
    if (page === 'marketing' || page === 'embed') {
      const socialEl = document.getElementById('mq-mk-social');
      if (socialEl && !socialEl.dataset.loaded && window._mqShopRecord) {
        socialEl.dataset.loaded = 'true';
        initMarketingKit(window._mqShopRecord);
      }
    }
    if (page === 'billing') {
      const planEl = document.getElementById('mq-billing-plan');
      if (planEl && planEl.textContent === 'Loading plan info...') {
        try {
          const { data: member } = await window.$memberstackDom.getCurrentMember();
          const plans = member?.planConnections || [];
          if (plans.length > 0) {
            const plan = plans[0];
            planEl.innerHTML = `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px">Active</span>
                <span style="font-size:14px;font-weight:500;color:#111">${plan.planName || plan.plan?.name || 'MidasQuote'}</span>
              </div>
              <p style="font-size:13px;color:#6b7280">Your subscription is active. Manage it using the buttons below.</p>`;
          } else {
            planEl.innerHTML = `<p style="font-size:13px;color:#6b7280">No active plan found. <a href="/pricing" style="color:#1a1a1a;font-weight:500">View plans →</a></p>`;
          }
        } catch(e) {
          planEl.innerHTML = `<p style="font-size:13px;color:#6b7280">Use the buttons below to manage your subscription.</p>`;
        }
      }
    }
    if (page === 'products') {
      const prodContent = document.getElementById('mq-products-content');
      if (prodContent) {
        prodContent.innerHTML = '<div class="mq-loading">Loading your products...</div>';
        atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${window._mqShopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`)
          .then(lineItems => {
            window._mqLineItems = lineItems;
            initProductsTab(window._mqShopRecord, lineItems);
          });
      }
    }
    if (page === 'pricing') {
      const helperContainer = document.getElementById('mq-pricing-helper-v2');
      if (helperContainer && !helperContainer.dataset.loaded) {
        helperContainer.dataset.loaded = 'true';
        const script = document.createElement('script');
        script.src = 'https://widget.midasquote.com/pricing-helper-v2.js';
        script.onload = function() {
          window.mqph2Init(window._mqShopRecord, window._mqPricingRecord);
        };
        document.body.appendChild(script);
      }
    }
  };

  init();

})();