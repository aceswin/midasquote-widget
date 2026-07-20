/*
 * MidasQuote Dashboard v1.0
 * Shop owner backend panel
 * Loads based on Memberstack member's shopToken
 * This is a test
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
    RESEND_API_KEY:     '',  // Removed — email sending goes through Cloudflare Worker which holds the key securely
    EMAIL_WORKER:       'https://midasquote-email.jordan132001.workers.dev',
    FROM_EMAIL:         'quotes@midasquote.com',
    IMAGE_UPLOAD_URL:   'https://midasquote-image-worker.jordan132001.workers.dev',
    IMAGE_UPLOAD_SECRET:'mq-upload-7f3k9xQ2',
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
  // Centers an element horizontally over .mq-content specifically (not the
  // whole viewport), so it sits between the sidebar and the right edge —
  // shared by the toast and the floating save button so they always line up.
  function mqCenterOverContent(node) {
    const content = document.querySelector('#midasquote-dashboard .mq-content');
    if (!node || !content) return;
    const rect = content.getBoundingClientRect();
    node.style.left = (rect.left + rect.width / 2) + 'px';
    node.style.transform = 'translateX(-50%)';
  }

  // Floating toast — guarantees the "saved!" confirmation is actually visible
  // regardless of where on a (possibly long) tab the triggering action
  // happened, whether that's a Save button, an inline checkbox toggle, or an
  // image upload finishing.
  function mqShowToast(msg, type = 'success') {
    let toast = document.getElementById('mq-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mq-toast';
      toast.style.cssText = "position:fixed;bottom:88px;z-index:99999;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.18);transition:opacity 0.25s ease;opacity:0;pointer-events:none;max-width:90vw;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
      document.body.appendChild(toast);
    }
    mqCenterOverContent(toast);
    const colors = { success: { bg:'#dcfce7', color:'#166534', border:'#86efac' }, error: { bg:'#fee2e2', color:'#991b1b', border:'#fca5a5' } };
    const c = colors[type] || colors.success;
    toast.style.background = c.bg;
    toast.style.color = c.color;
    toast.style.border = `1px solid ${c.border}`;
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._mqHideTimer);
    toast._mqHideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  function showMsg(id, msg, type = 'success') {
    const e = el(id);
    if (e) {
      e.textContent = msg;
      e.className = `mq-msg mq-msg-${type}`;
      e.style.display = 'block';
      setTimeout(() => { e.style.display = 'none'; }, 3000);
    }
    mqShowToast(msg, type);
  }

  // Floating "Save changes" button — originally built just for Project
  // Types (that tab got long enough that scrolling back down to one Save
  // button got tedious), now shared across every tab that has a save
  // action at all. mqNav looks up which action belongs to the tab being
  // switched to and passes it in; tabs with no save action (Leads,
  // Marketing Kit, Billing, etc.) just get it hidden entirely.
  function mqPositionFloatingSave() {
    mqCenterOverContent(document.getElementById('mq-floating-save'));
  }

  function mqToggleFloatingSave(action) {
    let btn = document.getElementById('mq-floating-save');
    if (!action) {
      if (btn) btn.style.display = 'none';
      window.removeEventListener('resize', mqPositionFloatingSave);
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'mq-floating-save';
      btn.style.cssText = "position:fixed;bottom:24px;z-index:9998;padding:13px 22px;border-radius:999px;border:none;background:#1a1a1a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:box-shadow 0.15s";
      btn.onmouseover = () => { btn.style.boxShadow = '0 14px 36px rgba(0,0,0,0.32)'; };
      btn.onmouseout = () => { btn.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)'; };
      document.body.appendChild(btn);
    }
    btn.textContent = action.label;
    btn.onclick = action.fn;
    btn.style.display = 'block';
    mqPositionFloatingSave();
    window.addEventListener('resize', mqPositionFloatingSave);
  }

  // One save action per tab that actually has one. Tabs not listed here
  // (Dashboard, Leads, Embed code, Marketing Kit, Billing) either have
  // nothing to save or autosave invisibly per field, so they get no
  // floating button at all.
  const MQ_PAGE_SAVE_ACTIONS = {
    shop:      { label: '💾 Save changes',  fn: () => window.mqSaveShop() },
    rooms:     { label: '💾 Save changes',  fn: () => window.mqSaveRooms() },
    specialty: { label: '💾 Save all',      fn: () => window.mqSaveAllSpecItems() },
    products:  { label: '💾 Save changes',  fn: () => window.mqSaveProducts() },
    templates: { label: '💾 Save all changes', fn: () => { window.mqSaveMasterRoomDefs(); window.mqSaveTemplatePhotos(); } },
  };

  // Per-tab help content shown in the "Need help?" modal. Written as plain
  // paragraphs/lists for now — designed so a video embed or screenshot can
  // just be dropped in above or below the text later without needing to
  // restructure anything.
  const MQ_HELP_CONTENT = {
    overview: {
      title: 'Dashboard',
      body: `
        <p>This is your at-a-glance summary — how many quotes have come in, and how recently. It's read-only; there's nothing to configure here.</p>
        <p>If you're just getting started, head to <strong>Shop info</strong> first, then <strong>Project types</strong>, then <strong>Pricing</strong> — that's the order that makes the rest of the dashboard make sense.</p>
      `
    },
    leads: {
      title: 'Leads',
      body: `
        <p>Every quote a customer runs through your widget shows up here automatically — their contact info (if they gave it), the project type, and the estimate they saw.</p>
        <p><strong>Statuses</strong> (New / Contacted / Booked / Lost) are just for your own tracking — customers never see these. Use the dropdown at the top to filter the list down to one status at a time.</p>
        <p>A customer can run the widget multiple times without giving their name — you'll still see those as separate quote attempts, just grouped together and numbered ("Estimate 1 of 2", etc.) so you can tell they're the same visitor.</p>
      `
    },
    shop: {
      title: 'Shop info',
      body: `
        <p>The basics that show up at the top of your widget — your logo, shop name, city, and phone number.</p>
        <p><strong>Disclaimer text</strong> is the fine print shown under every quote result (e.g. "Ballpark estimate only, contact us for a full quote"). Customize it however fits your business.</p>
        <p><strong>Consultation link/email</strong> — at least one of these needs to be filled in, since that's how customers actually reach you after seeing their estimate.</p>
        <p><strong>Financing toggle</strong> — turns on a small "Financing available" note on the results screen. Adding a financing link is optional — you can turn this on just to let customers know financing is available, without linking anywhere specific.</p>
        <p><strong>Showroom toggle</strong> — controls whether the "See our showroom" button shows up in your widget's header at all.</p>
        <p>Everything on this tab autosaves a second or two after you stop typing — you'll see a small toast confirm each save.</p>
      `
    },
    rooms: {
      title: 'Project types',
      body: `
        <p>Each project type (Kitchen, Bathroom, Refacing, or anything custom you add) is its own self-contained setup: its own description, cover photo, "how to measure" guide, and pricing behavior.</p>
        <p><strong>Price adjustments</strong> — four independent knobs per project type: Base cabinets, Upper cabinets, Installation, and Total ballpark. Each only affects what it says — e.g. the installation adjustment never touches material cost. Leave any of them at 0% to skip it entirely.</p>
        <p><strong>Live on widget / Draft</strong> — uncheck this while you're still setting a project type up, so customers don't see it half-finished.</p>
        <p><strong>Only show in MidasQuote Pro</strong> — hides this project type from the customer-facing widget completely, while still showing it in your own MidasQuote Pro link. Good for anything you only ever quote yourself.</p>
        <p><strong>Hide "How to measure" section</strong> — for a project type that's entirely flat-rate items with nothing to actually measure (like a general "Odd jobs" type), this removes that whole section from the widget for that type only.</p>
        <p>Accidentally deleted a standard type like Bathroom or Refacing? A "↩ Restore a default type…" dropdown appears automatically next to "+ Add room" whenever one's missing — it brings back the original description, image, and measuring guide.</p>
      `
    },
    pricing: {
      title: 'Pricing',
      body: `
        <p>This is where your actual cabinet, countertop, and trim pricing lives — box materials, door styles, hinges, drawer configurations, countertop materials, crown/valance, and tall cabinets.</p>
        <p><strong>Don't add handles or knobs here</strong> — if you supply hardware, add it as a Specialty Item instead with its own per-unit price, so customers can choose how many they need.</p>
        <p>Prices you set here are what the widget's calculator actually uses — this is the core of your quoting math, so it's worth double-checking a real project type end-to-end after making changes.</p>
      `
    },
    specialty: {
      title: 'Specialty items',
      body: `
        <p>Anything that isn't a standard cabinet box, door, or countertop — pullouts, lazy susans, custom range hoods, refacing-specific items, or anything unique to your shop.</p>
        <p><strong>Category</strong> — group items together (e.g. "Pullouts," "Corner Cabinets") so they show up organized on the widget instead of one long list. Leave it blank and the item just appears uncategorized — nothing changes if you never use this.</p>
        <p><strong>Offer supply/install choice?</strong> — check this if you want the customer to choose between "Supply only" and "Supplied & Installed" for this specific item, with its own installed price. Leave it unchecked and just pick which label is true from the dropdown instead — that's just a label, it doesn't change the price.</p>
        <p><strong>Project types</strong> column — click it to choose exactly which project types this item shows up for. Leave every box checked (the default) and it shows up everywhere.</p>
        <p>Use <strong>Filter by category</strong>, <strong>Filter by project type</strong>, and <strong>Search by name</strong> together to quickly find one item out of a long list.</p>
      `
    },
    embed: {
      title: 'Embed code',
      body: `
        <p>Three ways to actually get the widget in front of people, each in its own collapsible section:</p>
        <p><strong>Code for websites</strong> — the embed code to paste into your own website (Wix, Squarespace, WordPress, Webflow, etc.).</p>
        <p><strong>Direct link</strong> — a plain link that opens your quote tool directly, no website needed.</p>
        <p><strong>MidasQuote Pro</strong> — a separate link just for you (or someone you trust, like a regular contractor). It shows the real exact numbers behind every quote alongside the same ballpark customers see. Not for sharing with customers.</p>
        <p>Both links have "Add to Home Screen" instructions so they open like a real app on your phone — Android and Desktop Chrome even get a genuine one-tap "Install" button once you've used the page a bit.</p>
      `
    },
    products: {
      title: 'My Products',
      body: `
        <p>Add real photos for the materials, doors, hinges, drawers, countertops, trim, and specialty items you've configured elsewhere — these are what customers actually see on the widget instead of a generic icon.</p>
        <p>Don't have your own photo for something? Many common items already have one of our own curated photos ready to use — just pick "Choose from library" instead of uploading your own. No need to go find or shoot a photo for every single item yourself.</p>
        <p>Every category starts collapsed — click any category's header to open just that one. With a lot of items configured, this keeps the page manageable.</p>
        <p>You can also control which project types each item shows up for right from here — the same setting as on the Specialty Items tab, just accessible from both places.</p>
      `
    },
    templates: {
      title: 'Templates (Admin)',
      body: `
        <p>This tab only shows up for the admin account — it controls the <em>defaults</em> every brand new shop starts with, not any one specific shop's live data.</p>
        <p>Editing a project type's description, image, or measuring guide here only affects <strong>shops created from now on</strong> — it never retroactively changes a shop that already exists.</p>
        <p><strong>Push to all shops</strong> — pushes specialty item changes out to shops that already exist. Use this deliberately; it's the one action here that does touch live shops.</p>
      `
    },
    billing: {
      title: 'Billing',
      body: `
        <p>Your subscription and payment details for MidasQuote itself.</p>
      `
    },
    marketing: {
      title: 'Marketing Kit',
      body: `
        <p>Ready-made assets to help you promote your quote tool — share these however makes sense for your shop.</p>
      `
    },
  };

  window.mqShowHelp = function(pageId) {
    const content = MQ_HELP_CONTENT[pageId];
    if (!content) return;
    let modal = document.getElementById('mq-help-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mq-help-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:1.5rem';
      modal.addEventListener('click', (e) => { if (e.target === modal) window.mqCloseHelpModal(); });
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;padding:1.75rem;box-shadow:0 24px 60px rgba(0,0,0,0.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <div style="font-size:18px;font-weight:800;color:#111">❓ ${content.title}</div>
          <button onclick="mqCloseHelpModal()" style="background:none;border:none;font-size:22px;color:#9ca3af;cursor:pointer;line-height:1;padding:0 4px">×</button>
        </div>
        <div style="font-size:14px;color:#374151;line-height:1.7">${content.body}</div>
      </div>`;
    modal.style.display = 'flex';
  };
  window.mqCloseHelpModal = function() {
    const modal = document.getElementById('mq-help-modal');
    if (modal) modal.style.display = 'none';
  };

  // Shown exactly once per shop, ever — the moment a brand new shop owner
  // first loads their dashboard. Tracked on the shop record itself in
  // Airtable (not localStorage), so it correctly stays dismissed even if
  // they log in from a different device or browser later.
  window.mqShowWelcomeModal = function() {
    let modal = document.getElementById('mq-welcome-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mq-welcome-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100001;display:flex;align-items:center;justify-content:center;padding:1.5rem';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25)">
        <div style="font-size:40px;margin-bottom:12px">👋</div>
        <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:10px">Welcome to MidasQuote!</div>
        <div style="font-size:14px;color:#4b5563;line-height:1.7;margin-bottom:1.5rem;text-align:left">
          Every tab has a <strong style="color:#2563eb">❓ Need help?</strong> button in the top-right corner — click it any time you're not sure what something does. It walks through everything on that specific page, so you're never stuck guessing.
          <br><br>
          Take your time exploring — there's no rush, and almost everything here autosaves as you go.
        </div>
        <button onclick="mqCloseWelcomeModal()" style="width:100%;padding:13px;background:#1a1a1a;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">Got it, let's go!</button>
      </div>`;
    modal.style.display = 'flex';
  };
  window.mqCloseWelcomeModal = function() {
    const modal = document.getElementById('mq-welcome-modal');
    if (modal) modal.style.display = 'none';
    const shopRecord = window._mqShopRecord;
    if (shopRecord && !shopRecord.fields['Welcome popup seen']) {
      shopRecord.fields['Welcome popup seen'] = true;
      atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Welcome popup seen': true }).catch(()=>{});
    }
  };

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
      #midasquote-dashboard .mq-sidebar{width:220px;background:#fff;border-right:1px solid #e5e7eb;padding:1.5rem 0;flex-shrink:0;position:sticky;top:60px;align-self:flex-start;max-height:calc(100vh - 60px);overflow-y:auto}
      #midasquote-dashboard .mq-nav-item{display:flex;align-items:center;gap:10px;padding:11px 1.5rem;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;transition:all 0.15s;border-left:3px solid transparent}
      #midasquote-dashboard .mq-nav-item:hover{color:#111;background:#f9fafb}
      #midasquote-dashboard .mq-nav-item.active{color:#111;background:#f9fafb;border-left-color:#1a1a1a}
      #midasquote-dashboard .mq-nav-icon{font-size:16px;width:20px;text-align:center}
      #midasquote-dashboard .mq-nav-section{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;padding:1.25rem 1.5rem 0.5rem}
      #midasquote-dashboard .mq-content{flex:1;padding:2.5rem;overflow-y:visible}
      #midasquote-dashboard .mq-page{display:none;position:relative}
      #midasquote-dashboard .mq-help-btn{position:absolute;top:-32px;right:0;background:#eff6ff;color:#2563eb;border:1.5px solid #93c5fd;border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:background 0.15s;z-index:5}
      #midasquote-dashboard .mq-help-btn:hover{background:#dbeafe}
      #midasquote-dashboard .mq-help-badge{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#2563eb;color:#fff;font-size:11px;font-weight:800;flex-shrink:0}
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
      #midasquote-dashboard textarea{resize:vertical;min-height:40px}
      #midasquote-dashboard .mq-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1.25rem;margin-bottom:2rem}
      #midasquote-dashboard .mq-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem}
      #midasquote-dashboard .mq-stat-val{font-size:26px;font-weight:700;color:#111;margin-bottom:6px}
      #midasquote-dashboard .mq-stat-lbl{font-size:12px;color:#6b7280;font-weight:500}
      #midasquote-dashboard .mq-stat-green .mq-stat-val{color:#16a34a}
      #midasquote-dashboard .mq-stat-purple .mq-stat-val{color:#6366f1}
      #midasquote-dashboard .mq-table{width:100%;border-collapse:collapse}
      #midasquote-dashboard .mq-table th{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:left}
      #midasquote-dashboard .mq-table td{font-size:13px;padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#111}
      #midasquote-dashboard #mq-spec-table td{vertical-align:top;padding-top:14px}
      #midasquote-dashboard #mq-spec-table{border-collapse:separate;border-spacing:0 10px}
      #midasquote-dashboard #mq-spec-table td{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.07);border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
      #midasquote-dashboard #mq-spec-table td:first-child{border-left:1px solid #e5e7eb;border-radius:8px 0 0 8px}
      #midasquote-dashboard #mq-spec-table td:last-child{border-right:1px solid #e5e7eb;border-radius:0 8px 8px 0}
      #midasquote-dashboard #mq-spec-table thead th{border-bottom:2px solid var(--border)}
      #midasquote-dashboard #mq-spec-table-wrap{padding-left:14px}
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
      #midasquote-dashboard .mq-room-row.mq-room-open{border-color:#93c5fd!important;background:#f8fbff!important;box-shadow:0 2px 10px rgba(37,99,235,0.10)}
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
        #midasquote-dashboard .mq-sidebar{width:100%;padding:0.5rem 0;display:flex;overflow-x:auto;overflow-y:visible;border-right:none;border-bottom:1px solid #e5e7eb;-webkit-overflow-scrolling:touch;position:sticky;top:60px;max-height:none;z-index:90}
        #midasquote-dashboard .mq-nav-section{display:none}
        #midasquote-dashboard .mq-nav-item{flex-shrink:0;border-left:none;border-bottom:3px solid transparent;padding:10px 14px;white-space:nowrap}
        #midasquote-dashboard .mq-nav-item.active{border-left-color:transparent;border-bottom-color:#1a1a1a}
        #midasquote-dashboard .mq-content{padding:1.25rem}
        #midasquote-dashboard .mq-help-btn{top:-13px}
        #midasquote-dashboard #mq-pd-sticky-preview{top:auto!important;bottom:14px!important;right:14px!important;max-width:300px!important;width:auto!important;padding:10px!important;height:auto!important}
        #midasquote-dashboard #mq-pd-sticky-preview canvas{width:260px!important;height:auto!important;margin-bottom:8px!important}
        #midasquote-dashboard #mq-pd-sticky-preview button{font-size:13px!important;padding:8px!important;width:100%!important}
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
          <a href="https://www.midasquote.com/help" target="_blank" rel="noopener" style="font-size:13px;color:#6b7280;text-decoration:none;font-weight:500;margin-right:4px" onmouseover="this.style.color='#111'" onmouseout="this.style.color='#6b7280'">Help</a>
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
          <div class="mq-nav-item" onclick="mqNav('rooms',this)"><span class="mq-nav-icon">🚪</span> Project types</div>
          <div class="mq-nav-item" onclick="mqNav('specialty',this)"><span class="mq-nav-icon">⭐</span> Specialty items</div>
          <div class="mq-nav-item" onclick="mqNav('embed',this)"><span class="mq-nav-icon">🔗</span> Embed code</div>
          <div class="mq-nav-item" onclick="mqNav('products',this)"><span class="mq-nav-icon">📦</span> My Products</div>
          <div class="mq-nav-item" onclick="mqNav('marketing',this)"><span class="mq-nav-icon">📣</span> Marketing Kit</div>
          <div class="mq-nav-item" id="mq-nav-templates" onclick="mqNav('templates',this)" style="display:none"><span class="mq-nav-icon">🔧</span> Templates (Admin)</div>
          <div class="mq-nav-item" onclick="mqNav('billing',this)"><span class="mq-nav-icon">💳</span> Billing</div>
          <div class="mq-nav-item" onclick="mqNav('support',this)"><span class="mq-nav-icon">💬</span> Support</div>
        </div>

        <div class="mq-content">

          <!-- OVERVIEW -->
          <div class="mq-page active" id="mq-page-overview">
            <button class="mq-help-btn" onclick="mqShowHelp('overview')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">Welcome back 👋</div>
            <div class="mq-page-sub">Here's what's happening with your widget</div>
            <div class="mq-stat-grid" id="mq-stats">
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-leads">—</div><div class="mq-stat-lbl">Quotes generated</div></div>
              <div class="mq-stat mq-stat-green"><div class="mq-stat-val" id="mq-stat-new">—</div><div class="mq-stat-lbl">New this week</div></div>
              <div class="mq-stat mq-stat-purple"><div class="mq-stat-val" id="mq-stat-contacts">—</div><div class="mq-stat-lbl">With contact info</div></div>
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
            <button class="mq-help-btn" onclick="mqShowHelp('leads')"><span class="mq-help-badge">?</span> Need help?</button>
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
            <button class="mq-help-btn" onclick="mqShowHelp('shop')"><span class="mq-help-badge">?</span> Need help?</button>
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
                <div class="mq-field"><label class="mq-label">Brand colour</label>
                  <div style="display:flex;align-items:center;gap:8px">
                    <input type="text" id="mq-shop-color" placeholder="#1a1a1a" style="flex:1"/>
                    <input type="color" id="mq-shop-color-swatch" value="#1a1a1a" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;flex-shrink:0"/>
                  </div>
                  <span class="mq-hint">Hex code for widget buttons</span>
                </div>
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
                <label class="mq-label">Shop logo</label>
                <div id="mq-shop-logo-preview" style="margin-bottom:8px;display:none">
                  <img id="mq-shop-logo-img" src="" alt="Logo preview" style="height:56px;max-width:200px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:6px;background:#f9fafb"/>
                </div>
                <label class="mq-btn mq-btn-sm" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:8px">
                  📤 Upload logo image
                  <input type="file" id="mq-shop-logo-file" accept="image/*" style="display:none"/>
                </label>
                <div id="mq-shop-logo-upload-status" style="font-size:11px;color:#6b7280;margin-bottom:6px;min-height:14px"></div>
                <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Or paste a direct image URL:</div>
                <input type="url" id="mq-shop-logo" placeholder="https://yoursite.com/logo.png" oninput="mqRefreshLogoPreview()"/>
                <span class="mq-hint">Appears in the top-left corner of your widget</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Disclaimer text</label>
                <textarea id="mq-shop-disclaimer" placeholder="Ballpark estimate only. Contact us for a full quote."></textarea>
                <span class="mq-hint">Shown at the bottom of every quote</span>
              </div>
              <div id="mq-shop-consult-warning" class="mq-msg-error" style="display:none;margin-bottom:1rem;padding:10px 14px;border-radius:8px;font-size:13px">
                ⚠️ Please fill in at least one — a consultation link or a consultation email. Without one, customers just get sent to your quote form instead when they click "Ask a question" or "Book a consultation."
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">"Book a consultation" link <span style="font-weight:400;color:#9ca3af">(choose this or the email below)</span></label>
                <input type="url" id="mq-shop-consult-link" placeholder="https://yoursite.com/contact" oninput="mqCheckConsultFields()"/>
                <span class="mq-hint">If set, the widget's "Book a consultation" button opens this page in a new tab instead of the default contact form</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Or, consultation email <span style="font-weight:400;color:#9ca3af">(choose this or the link above)</span></label>
                <input type="email" id="mq-shop-consult-email" placeholder="sales@yourshop.com" oninput="mqCheckConsultFields()"/>
                <span class="mq-hint">Used only if no link is set above — opens a pre-filled email instead. At least one of these two fields is required.</span>
              </div>
              <div class="mq-toggle-row" style="margin-bottom:1rem">
                <div>
                  <div style="font-size:13px;font-weight:500;color:#111">We offer financing</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px">Shows a friendly "Financing available" note on the widget's quote results</div>
                </div>
                <div class="mq-toggle" id="mq-financing-toggle" onclick="mqToggleFinancing()"></div>
              </div>
              <div id="mq-financing-link-wrap" style="display:none;margin-bottom:1.5rem;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">
                <div class="mq-field" style="margin-bottom:0">
                  <label class="mq-label">Pre-approval link <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
                  <input type="url" id="mq-financing-link" placeholder="https://yourfinancingpartner.com/apply"/>
                  <span class="mq-hint">If you have a link where customers can apply for financing, enter it here. The "Ask a question" button on your widget will become "Get pre-approved →" and send them straight there.</span>
                </div>
              </div>
              <div class="mq-toggle-row" style="margin-bottom:1.5rem">
                <div>
                  <div style="font-size:13px;font-weight:500;color:#111">Show "View our products" link on widget</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px">Customers can browse your showroom before getting a quote</div>
                </div>
                <div class="mq-toggle on" id="mq-showroom-toggle" onclick="mqToggleShowroom()"></div>
              </div>
            </div>
          </div>

          <!-- ROOM TYPES -->
          <div class="mq-page" id="mq-page-rooms">
            <button class="mq-help-btn" onclick="mqShowHelp('rooms')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">Project types</div>
            <div class="mq-page-sub">Set up the project types your widget offers — rooms, service tiers, or anything else — and adjust pricing up or down for each one. Great for things like "Kitchen Reno — Premium" vs. "Luxury," or a bathroom vanity running smaller than a kitchen cabinet at the same length.</div>
            <div class="mq-card">
              <div id="mq-rooms-msg"></div>
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;color:#1e40af;line-height:1.6">
                💡 Base cabinets and Upper cabinets adjustments apply to box material cost only — never door, drawer, or hinge pricing. Installation applies to labor cost only. Total ballpark adjusts everything at once. Check any combination that applies, or leave everything at 0% for no adjustment.
              </div>
              <div id="mq-rooms-list"></div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;margin-bottom:1.25rem">
                <button class="mq-btn mq-btn-sm" onclick="mqAddRoom()">+ Add room</button>
                <select id="mq-restore-room-select" onchange="mqRestoreDefaultRoom(this.value)" style="font-size:13px;padding:7px 8px;border:1px solid #d1d5db;border-radius:6px;display:none">
                  <option value="">↩ Restore a default type…</option>
                </select>
              </div>
            </div>
          </div>

          <!-- PRICING -->
          <div class="mq-page" id="mq-page-pricing">
            <button class="mq-help-btn" onclick="mqShowHelp('pricing')"><span class="mq-help-badge">?</span> Need help?</button>
            <div style="height:24px"></div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:1rem;font-size:13px;color:#92400e;line-height:1.6">
              🔧 <strong>Handles & knobs:</strong> Do not include hardware costs in your pricing here. If you supply handles or knobs, add them as a specialty items instead.
            </div>
            <div id="mq-pricing-helper-v2"></div>
          </div>

          <!-- SPECIALTY ITEMS -->
          <div class="mq-page" id="mq-page-specialty">
            <button class="mq-help-btn" onclick="mqShowHelp('specialty')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-section-header">
              <div>
                <div class="mq-page-title">Specialty items</div>
                <div class="mq-page-sub">Add-ons that appear as options in your widget. Include the full cost in your price — materials, hardware, and installation. What you enter is what gets added to the quote.</div>
              </div>
              <button class="mq-btn mq-btn-primary mq-btn-sm" onclick="mqAddSpecItem()">+ New item</button>
            </div>
            <div id="mq-spec-msg"></div>
            <div class="mqph-hl" style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:1rem;font-size:13px;color:#166534;line-height:1.7">
              💡 <strong>Pricing tip:</strong> If your specialty item is priced by the linear foot or square foot, check the <strong>Per lin ft</strong> or <strong>Per sq ft</strong> box and enter your per-unit rate. For flat-rate items, leave both unchecked and enter the flat price.
              <br><br>
              🔧 <strong>Handles & knobs:</strong> If you supply hardware, add each type as a specialty item (e.g. "Standard handle", "Standard knob") with your per-unit price. Customers can then add how many they need. If you don't supply hardware, leave it out — the widget will automatically let customers know it's not included.
              <br><br>
              🏷️ <strong>Supply vs. install pricing:</strong> Leave "Offer supply/install choice?" unchecked if this item only ever comes one way — just pick whichever label is true in the dropdown next to it (doesn't change the price, just what the customer sees). Check the box if you want the <em>customer</em> to choose between the two for this specific item — then enter a separate installed price, since the price above only covers supply.
            </div>
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div id="mq-spec-list"><div class="mq-loading">Loading specialty items...</div></div>
            </div>
          </div>

          <!-- EMBED CODE -->
          <div class="mq-page" id="mq-page-embed">
            <button class="mq-help-btn" onclick="mqShowHelp('embed')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">Embed code</div>
            <div class="mq-page-sub">Pick what you want, then copy one combined block of code to paste into your website.</div>

            <!-- ============================================================
                 SECTION 1: Code for websites — the embed-code builder plus
                 platform install instructions, all folded up together.
            ============================================================= -->
            <div class="mq-card" style="padding:0;overflow:hidden;margin-bottom:14px">
              <div onclick="mqToggleEmbedSection('websites')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">🌐 Code for websites</div>
                <span id="mq-embed-websites-arrow" style="display:inline-block;transition:transform 0.2s;font-size:13px;color:#9ca3af">▶</span>
              </div>
              <div id="mq-embed-websites-body" style="display:none;padding:0 1.25rem 1.25rem">

                <!-- Combined builder card -->
                <div class="mq-card" style="border:2px solid #1a1a1a">
                  <div class="mq-card-title" style="font-size:15px">🧩 Build your embed code</div>
                  <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Check the pieces you want — the combined code updates automatically. Paste it all in one go.</p>

                  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem">
                    <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer" onclick="mqUpdateCombinedEmbed()">
                      <input type="checkbox" id="mq-embed-chk-header" checked style="width:18px;height:18px;flex-shrink:0;accent-color:#1a1a1a"/>
                      <div>
                        <div style="font-size:13px;font-weight:600;color:#111">🎯 Quote page header</div>
                        <div style="font-size:11px;color:#6b7280;margin-top:2px">Big headline + subtitle above your widget</div>
                      </div>
                    </label>
                    <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer" onclick="mqUpdateCombinedEmbed()">
                      <input type="checkbox" id="mq-embed-chk-trust" checked style="width:18px;height:18px;flex-shrink:0;accent-color:#1a1a1a"/>
                      <div>
                        <div style="font-size:13px;font-weight:600;color:#111">✅ Trust bar</div>
                        <div style="font-size:11px;color:#6b7280;margin-top:2px">"No commitment required · Results sent to inbox" row</div>
                      </div>
                    </label>
                    <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer" onclick="mqUpdateCombinedEmbed()">
                      <input type="checkbox" id="mq-embed-chk-widget" checked style="width:18px;height:18px;flex-shrink:0;accent-color:#1a1a1a"/>
                      <div>
                        <div style="font-size:13px;font-weight:600;color:#111">📋 Widget embed code</div>
                        <div style="font-size:11px;color:#6b7280;margin-top:2px">The quote widget itself — required for it to appear</div>
                      </div>
                    </label>
                  </div>

                  <!-- Live preview -->
                  <div id="mq-embed-preview-wrap" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;margin-bottom:1.25rem;transform:scale(0.75);transform-origin:top left;width:133%;margin-right:-33%">
                    <div id="mq-embed-preview-header"></div>
                    <div id="mq-embed-preview-trust"></div>
                    <div style="background:#fff;border:1.5px dashed #d1d5db;border-radius:10px;padding:1.5rem;text-align:center;font-size:13px;color:#9ca3af" id="mq-embed-preview-widget">📋 Widget appears here</div>
                  </div>

                  <div class="mq-embed-box" style="margin-bottom:10px"><span id="mq-combined-embed-display" style="white-space:pre-wrap;word-break:break-all"></span></div>
                  <button class="mq-btn mq-btn-primary" id="mq-combined-copy-btn" onclick="mqCopyCombinedEmbed(this)" style="width:100%">📋 Copy combined code</button>
                </div>

                <div class="mq-card">
                  <div class="mq-card-title">💡 Installation help</div>
                  <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:#374151;line-height:1.6">
                    <div><strong>Wix:</strong> Add → Embed → Embed a Widget → paste your code</div>
                    <div><strong>Squarespace:</strong> Edit page → Add block → Code → paste your code</div>
                    <div><strong>WordPress:</strong> Add block → Custom HTML → paste your code</div>
                    <div><strong>Webflow:</strong> Add element → Embed → paste your code</div>
                    <div><strong>Need help?</strong> Email <a href="mailto:support@midasquote.com" style="color:#1a1a1a">support@midasquote.com</a></div>
                  </div>
                </div>

              </div>
            </div>

            <!-- ============================================================
                 SECTION 2: Direct link — the plain quote-tool link (no
                 website needed) plus its own homescreen instructions.
            ============================================================= -->
            <div class="mq-card" style="padding:0;overflow:hidden;margin-bottom:14px">
              <div onclick="mqToggleEmbedSection('direct')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">📱 Direct link</div>
                <span id="mq-embed-direct-arrow" style="display:inline-block;transition:transform 0.2s;font-size:13px;color:#9ca3af">▶</span>
              </div>
              <div id="mq-embed-direct-body" style="display:none;padding:0 1.25rem 1.25rem">

                <div class="mq-card">
                  <div class="mq-card-title">📱 Direct quote link</div>
                  <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Opens your quote tool directly — share on social media, Google Business Profile, email signature, or anywhere online. No website needed. Or use it for walk-in customers, right on the spot.</p>
                  <div class="mq-embed-box">https://widget.midasquote.com/?shop=${token}&mode=shop
                    <div style="position:absolute;top:8px;right:8px;display:flex;gap:6px">
                      <button onclick="window.open('https://widget.midasquote.com/?shop=${token}&mode=shop','_blank')" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit">Open ↗</button>
                      <button class="mq-copy-btn" style="position:static" onclick="mqCopyText('https://widget.midasquote.com/?shop=${token}&mode=shop',this)">Copy</button>
                    </div>
                  </div>
                </div>

                <div class="mq-card">
                  <div class="mq-card-title">📱 Add MidasQuote shortcut to your homescreen</div>
                  <p class="mq-hint" style="margin-bottom:12px">
                    Keep your quote tool one tap away — great for quoting walk-in customers on the spot, without digging through browser tabs or bookmarks.
                  </p>
                  ${mqAddToHomescreenInstructionsHTML()}
                </div>

              </div>
            </div>

            <!-- ============================================================
                 SECTION 3: MidasQuote Pro — the real-numbers version, for
                 the shop owner (or anyone they trust, like a regular
                 contractor) rather than customers.
            ============================================================= -->
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleEmbedSection('pro')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">⚡ MidasQuote Pro</div>
                <span id="mq-embed-pro-arrow" style="display:inline-block;transition:transform 0.2s;font-size:13px;color:#9ca3af">▶</span>
              </div>
              <div id="mq-embed-pro-body" style="display:none;padding:0 1.25rem 1.25rem">

                <div class="mq-card">
                  <div class="mq-card-title">⚡ Your MidasQuote Pro link</div>
                  <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">This one's just for you — or anyone you want to bring in, like a contractor you always work with. It shows the exact real numbers behind every quote, right alongside the same ballpark range your customers see. Not for sharing with customers.</p>
                  <div class="mq-embed-box">https://widget.midasquote.com/pro.html?shop=${token}
                    <div style="position:absolute;top:8px;right:8px;display:flex;gap:6px">
                      <button onclick="window.open('https://widget.midasquote.com/pro.html?shop=${token}','_blank')" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit">Open ↗</button>
                      <button class="mq-copy-btn" style="position:static" onclick="mqCopyText('https://widget.midasquote.com/pro.html?shop=${token}',this)">Copy</button>
                    </div>
                  </div>
                </div>

                <div class="mq-card">
                  <div class="mq-card-title">📱 Add MidasQuote Pro shortcut to your homescreen</div>
                  <p class="mq-hint" style="margin-bottom:12px">
                    Keep it one tap away for quoting on the go, walking a jobsite, or sitting across the table from a customer.
                  </p>
                  ${mqAddToHomescreenInstructionsHTML()}
                </div>

              </div>
            </div>

          </div>

          <!-- MY PRODUCTS -->
          <div class="mq-page" id="mq-page-products">
            <button class="mq-help-btn" onclick="mqShowHelp('products')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">My Products</div>
            <div class="mq-page-sub">Manage everything about how each item shows up on your widget: photos and thumbnails customers see while quoting, which project types each item is available for, and which items to hide entirely. Category-level shortcuts let you show or hide a whole group at once — individual items can still override that.</div>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:13px;color:#92400e;line-height:1.7">
              <strong>💡 How to add a photo:</strong><br>
              <strong>Option 1 —</strong> Click <em>"📤 Upload a photo"</em> on any item below and choose a photo straight from your device — easiest option, hosted permanently for you.<br>
              <strong>Option 2 —</strong> Click <em>"📷 Choose from library"</em> to pick from our curated cabinet & countertop photo collection.<br>
              <strong>Option 3 —</strong> Already have a photo hosted somewhere reliable? Paste its direct image link instead — just avoid social media links, since those expire and will eventually break.
            </div>
            <div id="mq-products-msg"></div>
            <div id="mq-products-content"><div class="mq-loading">Loading your products...</div></div>
            <div class="mq-card" style="margin-top:1rem">
              <div class="mq-card-title">🔗 Your showroom link</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:0.75rem">Share this with customers so they can browse your products before getting a quote.</p>
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;color:#1e40af">💡 If <strong>"Show View our products link"</strong> is turned on in your Shop Info tab, this link is automatically included in your widget — no extra setup needed.</div>
              <div class="mq-embed-box"><span id="mq-showroom-link-text"></span><button class="mq-copy-btn" id="mq-showroom-copy-btn">Copy</button></div>
              <button class="mq-btn" style="margin-top:10px" id="mq-showroom-open-btn">Open showroom ↗</button>
            </div>
          </div>

          <!-- TEMPLATES (ADMIN ONLY) -->
          <div class="mq-page" id="mq-page-templates">
            <button class="mq-help-btn" onclick="mqShowHelp('templates')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">🔧 Templates (Admin)</div>
            <div class="mq-page-sub">Manage the master specialty items for Refacing, Repainting, and Restaining. These are what every new shop gets automatically — add real door styles, prices, and photos here so shop owners never start from a blank page.</div>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:13px;color:#991b1b;line-height:1.6">
              <strong>⚠️ Editing here alone changes nothing live.</strong> Changes only apply to a shop once you actually click "Push" — but be aware: pushing to an item a shop already has now <strong>fully overwrites</strong> its name, price, units, project types, and photo to match the master (this is intentional while you're still setting things up, since there's nothing real to protect yet — this should get smarter once real shops exist and may have customized their own copies).
            </div>
            <div id="mq-templates-msg"></div>
            <div class="mq-card" style="margin-bottom:1.5rem">
              <div class="mq-card-title">🏷️ Default project type descriptions</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">These are the name and description every brand-new shop gets automatically for Refacing, Repainting, and Restaining — the note customers see on the widget when they pick that project type. Editing here only affects shops seeded from now on; it doesn't retroactively change any shop's existing project types.</p>
              <div id="mq-master-rooms-content"><div class="mq-loading">Loading...</div></div>
            </div>
            <div id="mq-templates-content"><div class="mq-loading">Loading templates...</div></div>
            <button class="mq-btn" style="margin-top:8px" onclick="mqAddTemplateItem()">+ Add template item</button>
            <div class="mq-card" style="margin-top:1.5rem">
              <div class="mq-card-title">📤 Push to all shops</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:0.75rem">Adds any template items a shop doesn't already have yet. Never touches or removes anything a shop already received from a previous push, even if you've since edited it here.</p>
              <button class="mq-btn mq-btn-primary" onclick="mqPushTemplatesToAllShops()">Push new template items to all shops</button>
            </div>
          </div>

          <!-- BILLING -->
          <div class="mq-page" id="mq-page-billing">
            <button class="mq-help-btn" onclick="mqShowHelp('billing')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">Billing</div>
            <div class="mq-page-sub">Manage your subscription, payment method, and invoices</div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">📋 Current plan</div>
              <div id="mq-billing-plan" style="font-size:14px;color:#6b7280;margin-bottom:1.25rem">Loading plan info...</div>
              <div id="mq-billing-active-actions" style="display:none;gap:10px;flex-wrap:wrap">
                <button class="mq-btn mq-btn-primary" onclick="mqOpenBillingPortal()">Manage plan</button>
                <button class="mq-btn" onclick="mqUpgradeToAnnual()">Upgrade to annual</button>
              </div>
              <div id="mq-billing-reactivate-actions" style="display:none;gap:10px;flex-wrap:wrap">
                <button class="mq-btn mq-btn-primary" onclick="mqReactivate('prc_midasquote-monthly-plan-i7d0ryx')">Reactivate — Monthly</button>
                <button class="mq-btn" onclick="mqReactivate('prc_midasquote-annual-plan-hui0rv4')">Reactivate — Annual</button>
              </div>
            </div>

            <div class="mq-card" style="margin-bottom:1rem" id="mq-billing-payment-card">
              <div class="mq-card-title">💳 Payment method</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Update your credit card or billing details.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">Update payment method</button>
            </div>

            <div class="mq-card" style="margin-bottom:1rem" id="mq-billing-invoices-card">
              <div class="mq-card-title">🧾 Invoices</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">View and download your past invoices.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">View invoices</button>
            </div>

            <div class="mq-card" style="border-color:#fca5a5" id="mq-billing-cancel-card">
              <div class="mq-card-title" style="color:#dc2626">⚠️ Cancel subscription</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:6px;line-height:1.6">We're sorry to see you go. You can cancel at any time — your widget stays active until the end of your current billing period.</p>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.6">Your leads and pricing data will be available for 30 days after cancellation.</p>
              <button class="mq-btn mq-btn-danger" onclick="mqOpenBillingPortal()">Cancel subscription</button>
            </div>
          </div>

          <!-- SUPPORT -->
          <div class="mq-page" id="mq-page-support">
            <div class="mq-page-title">Support</div>
            <div class="mq-page-sub">Have a question or an idea? Send it straight to us — your shop info is included automatically.</div>
            <div class="mq-card" style="max-width:520px">
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">Your email <span style="color:#dc2626">*</span></label>
                <div style="display:flex;gap:8px">
                  <input type="email" id="mq-support-email" placeholder="you@example.com" required style="flex:1"/>
                  <button type="button" class="mq-btn mq-btn-sm" id="mq-support-use-shop-email" onclick="mqUseShopInfoEmail()" style="flex-shrink:0;white-space:nowrap">Use my Shop Info email</button>
                </div>
                <span class="mq-hint">So we know where to send our reply</span>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">Topic</label>
                <select id="mq-support-topic">
                  <option value="Question">Just a question</option>
                  <option value="Support">Support — something's not working right</option>
                  <option value="Suggestion">Suggestion — an idea for MidasQuote</option>
                </select>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">Message</label>
                <textarea id="mq-support-message" rows="6" placeholder="Tell us what's going on..."></textarea>
              </div>
              <button class="mq-btn mq-btn-primary" id="mq-support-submit-btn" onclick="mqSubmitSupport()">Send</button>
              <div id="mq-support-status" style="font-size:13px;margin-top:10px"></div>
            </div>
          </div>

          <!-- MARKETING KIT -->
          <div class="mq-page" id="mq-page-marketing">
            <button class="mq-help-btn" onclick="mqShowHelp('marketing')"><span class="mq-help-badge">?</span> Need help?</button>
            <div class="mq-page-title">Marketing Kit</div>
            <div class="mq-page-sub">Ready-made copy to help you promote your new quote widget — personalized with your shop's link</div>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem">
              <label class="mq-label" style="display:block;margin-bottom:6px">Link to use across everything below</label>
              <div style="display:flex;gap:8px">
                <input type="url" id="mq-mk-post-link" placeholder="https://yoursite.com/get-a-quote" style="flex:1"/>
                <button class="mq-btn mq-btn-sm" id="mq-mk-post-link-apply" style="flex-shrink:0">Apply</button>
              </div>
              <span class="mq-hint">Paste the link to your quote page — if you leave this blank, everything below uses your raw widget link instead</span>
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 12px;margin-top:8px;font-size:12px;color:#166534">✅ Once applied, this link is automatically used across every marketing item on this page — posts, graphics, QR codes, and everything else.</div>
            </div>

            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('social')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">📱 Social media posts</div>
                <span id="mq-mk-arrow-social" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-social" style="display:none;padding:0 1.25rem 1.25rem">
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Copy and paste these straight into Facebook or Instagram.</p>
              <div id="mq-mk-social"></div>
              </div>
            </div>

            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('graphic')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">🖼️ Social graphic — ready to post</div>
                <span id="mq-mk-arrow-graphic" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-graphic" style="display:none;padding:0 1.25rem 1.25rem">
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">A square Instagram/Facebook-ready graphic with your shop name, brand colour, and quote link already on it. Download and post — no design needed.</p>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1rem">
                <canvas id="mq-mk-canvas" width="1080" height="1080" style="width:280px;height:280px;border-radius:14px;display:block"></canvas>
                <div style="width:100%;max-width:280px">
                  <label class="mq-label" style="display:block;margin-bottom:6px;font-size:11px">Headline text</label>
                  <input type="text" id="mq-mk-graphic-headline" placeholder="Get your cabinet quote in under 2 minutes" maxlength="60" style="font-size:13px"/>
                </div>
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
            </div>

            <div class="mq-card" id="mq-pd-outer-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('poster')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">🎨 Custom Poster & Sign Designer</div>
                <span id="mq-mk-arrow-poster" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-poster" style="display:none;padding:0 1.25rem 1.25rem">
              <p style="font-size:13px;color:var(--text-mid);margin-bottom:1rem">Pick a style, add your own project photo, and download a print-ready poster or yard sign — pick "Landscape" below for a yard sign.</p>

              <div class="mq-field" style="margin-bottom:12px">
                <label class="mq-label">Style</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <div class="mq-pd-template-thumb selected" data-template="curved-split" onclick="mqPdSelectTemplate('curved-split',this)" style="cursor:pointer;border:2px solid #1a1a1a;border-radius:8px;padding:6px;text-align:center;width:84px">
                    <div style="width:100%;height:50px;border-radius:5px;background:linear-gradient(120deg,#fff 45%,#1a3a6b 55%)"></div>
                    <div style="font-size:10.5px;margin-top:4px;font-weight:600">Curved Split</div>
                  </div>
                  <div class="mq-pd-template-thumb" data-template="diamond-arrow" onclick="mqPdSelectTemplate('diamond-arrow',this)" style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;padding:6px;text-align:center;width:84px">
                    <div style="width:100%;height:50px;border-radius:5px;background:linear-gradient(100deg,#111 45%,#c9a24b 47%,#8a6d2b 49%,#333 52%)"></div>
                    <div style="font-size:10.5px;margin-top:4px;font-weight:600">Diamond Arrow</div>
                  </div>
                  <div class="mq-pd-template-thumb" data-template="ornate-divider" onclick="mqPdSelectTemplate('ornate-divider',this)" style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;padding:6px;text-align:center;width:84px">
                    <div style="width:100%;height:50px;border-radius:50%/20%;background:linear-gradient(#fff 45%,#8a5a3a 47%)"></div>
                    <div style="font-size:10.5px;margin-top:4px;font-weight:600">Ornate Divider</div>
                  </div>
                  <div class="mq-pd-template-thumb" data-template="circular-badge" onclick="mqPdSelectTemplate('circular-badge',this)" style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;padding:6px;text-align:center;width:84px">
                    <div style="width:100%;height:50px;border-radius:5px;background:#3a3a3a;position:relative">
                      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;border:2px solid #c9a24b"></div>
                    </div>
                    <div style="font-size:10.5px;margin-top:4px;font-weight:600">Circular Badge</div>
                  </div>
                  <div class="mq-pd-template-thumb" data-template="bold-modern" onclick="mqPdSelectTemplate('bold-modern',this)" style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;padding:6px;text-align:center;width:84px">
                    <div style="width:100%;height:50px;border-radius:5px;background:linear-gradient(90deg,#1a3a6b 45%,#666 47%)"></div>
                    <div style="font-size:10.5px;margin-top:4px;font-weight:600">Bold Modern</div>
                  </div>
                </div>
              </div>

              <div class="mq-field" style="margin-bottom:12px">
                <label class="mq-label">Orientation</label>
                <div style="display:flex;gap:8px">
                  <button class="mq-btn mq-btn-sm" id="mq-pd-orient-portrait" onclick="mqPdSetOrientation('portrait')">📱 Portrait — poster</button>
                  <button class="mq-btn mq-btn-sm" id="mq-pd-orient-landscape" onclick="mqPdSetOrientation('landscape')">🖥️ Landscape — yard sign</button>
                </div>
              </div>

              <div class="mq-grid2">
                <div class="mq-field">
                  <label class="mq-label">Project photo</label>
                  <button class="mq-btn mq-btn-sm" onclick="document.getElementById('mq-pd-photo-input').click()">📤 Upload photo</button>
                  <input type="file" id="mq-pd-photo-input" accept="image/*" style="display:none"/>
                </div>
                <div class="mq-field">
                  <label class="mq-label">Text or your logo?</label>
                  <select id="mq-pd-text-mode" onchange="mqPdTextModeChanged()">
                    <option value="text">Text (shop name + tagline)</option>
                    <option value="logo">My own logo image</option>
                  </select>
                </div>
              </div>

              <div class="mq-field" id="mq-pd-logo-upload-wrap" style="display:none;margin-bottom:12px">
                <label class="mq-label">Logo image</label>
                <button class="mq-btn mq-btn-sm" onclick="document.getElementById('mq-pd-logo-input').click()">📤 Upload logo</button>
                <input type="file" id="mq-pd-logo-input" accept="image/*" style="display:none"/>
                <p style="font-size:11px;color:#9ca3af;margin-top:4px">This is separate from your Shop Info logo — upload whatever image you want to appear here specifically.</p>
                <label class="mq-label" style="margin-top:10px;display:block">Logo size</label>
                <input type="range" id="mq-pd-logo-size" min="50" max="250" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
              </div>

              <div class="mq-field" style="margin-bottom:12px">
                <label class="mq-label">Tagline</label>
                <input type="text" id="mq-pd-tagline" value="Custom Kitchens & Millwork" maxlength="60" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()"/>
              </div>

              <div class="mq-field" style="margin-bottom:12px">
                <label class="mq-label">Badge text <span style="font-weight:400;color:#9ca3af;text-transform:none">(Circular Badge style only — independent of your shop name)</span></label>
                <input type="text" id="mq-pd-badge-text" placeholder="e.g. DR" maxlength="4" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()"/>
              </div>

              <div class="mq-card" style="padding:0;overflow:hidden;margin-bottom:1rem">
                <div onclick="mqPdToggleColorSection()" style="display:flex;align-items:center;justify-content:space-between;padding:14px;cursor:pointer;background:#f9fafb">
                  <div style="font-size:13px;font-weight:700;color:#374151">🎨 Colours &amp; Text Style</div>
                  <span id="mq-pd-color-section-arrow" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
                </div>
                <div id="mq-pd-color-section-body" style="padding:14px">
                  <div class="mq-grid2">
                    <div class="mq-field">
                      <label class="mq-label">Background colour</label>
                      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <input type="color" id="mq-pd-bg-color" value="#ffffff" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#6b7280;cursor:pointer">
                          <input type="checkbox" id="mq-pd-bg-gradient" onchange="mqPdToggleGradientColor2('mq-pd-bg-color2-wrap',this.checked)" style="width:auto"/> Gradient
                        </label>
                        <span id="mq-pd-bg-color2-wrap" style="display:none">
                          <input type="color" id="mq-pd-bg-color2" value="#f0f0f0" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                        </span>
                      </div>
                      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;margin-top:8px;cursor:pointer">
                        <input type="checkbox" id="mq-pd-bg-image-enabled" onchange="mqPdBgImageToggled()" style="width:auto"/> Use an image instead
                      </label>
                      <div id="mq-pd-bg-image-upload-wrap" style="display:none;margin-top:6px">
                        <button class="mq-btn mq-btn-sm" onclick="document.getElementById('mq-pd-bg-image-input').click()">📤 Upload background image</button>
                        <input type="file" id="mq-pd-bg-image-input" accept="image/*" style="display:none"/>
                        <div style="margin-top:8px">
                          <button class="mq-btn mq-btn-sm" onclick="mqPdLoadTextureLibrary()">🧱 Or choose from our texture library</button>
                          <div id="mq-pd-texture-grid" style="display:none;margin-top:8px;max-height:180px;overflow-y:auto;grid-template-columns:repeat(4,1fr);gap:6px"></div>
                        </div>
                      </div>
                    </div>
                    <div class="mq-field">
                      <label class="mq-label">Shape colour</label>
                      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <input type="color" id="mq-pd-shape-color" value="#1a3a6b" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#6b7280;cursor:pointer">
                          <input type="checkbox" id="mq-pd-shape-gradient" onchange="mqPdToggleGradientColor2('mq-pd-shape-color2-wrap',this.checked)" style="width:auto"/> Gradient
                        </label>
                        <span id="mq-pd-shape-color2-wrap" style="display:none">
                          <input type="color" id="mq-pd-shape-color2" value="#378ADD" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mq-field" style="margin-top:12px">
                    <label class="mq-label">Accent line colour</label>
                    <input type="color" id="mq-pd-accent-color" value="#c9a24b" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                  </div>

                  <div style="border-top:1px solid #e5e7eb;margin:14px 0 0;padding-top:14px">
                    <div class="mq-field" style="margin-bottom:12px">
                      <label class="mq-label">"Another project by" text</label>
                      <input type="text" id="mq-pd-pre-text" value="Another project by" maxlength="40" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()"/>
                    </div>
                    <div class="mq-grid2">
                      <div class="mq-field">
                        <label class="mq-label">"Another project by" colour</label>
                        <input type="color" id="mq-pd-pre-color" value="#6b6b6b" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                      </div>
                      <div class="mq-field">
                        <label class="mq-label">Tagline colour</label>
                        <input type="color" id="mq-pd-tag-color" value="#4b4b4b" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                      </div>
                    </div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-top:10px;cursor:pointer">
                      <input type="checkbox" id="mq-pd-text-shadow" onchange="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:auto"/> Add drop shadow to all text
                    </label>
                  </div>
                </div>
              </div>

              <div class="mq-card" style="background:#f9fafb;padding:14px;margin-bottom:1rem">
                <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">Text size &amp; layout</div>
                <div class="mq-grid2" style="margin-bottom:8px">
                  <div class="mq-field">
                    <label class="mq-label">"Another project by" size</label>
                    <input type="range" id="mq-pd-size-pre" min="50" max="280" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                  </div>
                  <div class="mq-field">
                    <label class="mq-label">Shop name size</label>
                    <input type="range" id="mq-pd-size-name" min="50" max="280" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                  </div>
                </div>
                <div class="mq-grid2" style="margin-bottom:8px">
                  <div class="mq-field">
                    <label class="mq-label">Tagline size</label>
                    <input type="range" id="mq-pd-size-tag" min="50" max="280" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                  </div>
                  <div class="mq-field">
                    <label class="mq-label">Space between lines</label>
                    <input type="range" id="mq-pd-line-spacing" min="60" max="180" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                  </div>
                </div>
                <div class="mq-field">
                  <label class="mq-label">Move whole text block up / down</label>
                  <input type="range" id="mq-pd-text-offset" min="-100" max="100" value="0" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                </div>
              </div>

              <div class="mq-card" style="background:#f9fafb;padding:14px;margin-bottom:1rem">
                <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">QR code &amp; quote button <span style="font-weight:400;text-transform:none;color:#9ca3af">(both optional)</span></div>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:10px;cursor:pointer">
                  <input type="checkbox" id="mq-pd-qr-enabled" onchange="mqPdQrToggled()" style="width:auto"/> Add a QR code onto the photo
                </label>
                <div id="mq-pd-qr-controls-wrap" style="display:none;margin-bottom:12px">
                  <div class="mq-grid2">
                    <div class="mq-field">
                      <label class="mq-label">QR code size</label>
                      <input type="range" id="mq-pd-qr-size" min="50" max="220" value="100" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                    </div>
                    <div class="mq-field">
                      <label class="mq-label">QR code position (up/down)</label>
                      <input type="range" id="mq-pd-qr-position" min="-100" max="100" value="0" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                    </div>
                  </div>
                </div>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                  <input type="checkbox" id="mq-pd-btn-enabled" onchange="mqPdBtnToggled()" style="width:auto"/> Add a "Get a Free Quote" button
                </label>
                <div id="mq-pd-btn-controls-wrap" style="display:none;margin-top:10px">
                  <div class="mq-field">
                    <label class="mq-label">Button position (up/down)</label>
                    <input type="range" id="mq-pd-btn-position" min="-100" max="100" value="0" oninput="window._mqRedrawPosterDesigner && window._mqRedrawPosterDesigner()" style="width:100%"/>
                  </div>
                </div>
              </div>
              </div>

              <div style="display:none;position:fixed;top:90px;right:30px;max-width:480px;z-index:50;text-align:center;background:#fff;padding:12px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2)" id="mq-pd-sticky-preview">
                <canvas id="mq-pd-canvas" width="1080" height="1620" onclick="mqPdOpenZoom()" style="width:auto;height:300px;border-radius:10px;display:block;margin:0 auto 10px;box-shadow:0 6px 24px rgba(0,0,0,0.18);cursor:zoom-in" title="Tap to zoom"></canvas>
                <button class="mq-btn mq-btn-primary" id="mq-pd-download-btn" style="width:100%;display:block;margin:0 auto">⬇️ Download (PNG)</button>
              </div>

            </div>

            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('dm')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">💬 Direct message template</div>
                <span id="mq-mk-arrow-dm" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-dm" style="display:none;padding:0 1.25rem 1.25rem">
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Send this to past customers or leads who might have a future project.</p>
              <div id="mq-mk-dm"></div>
              </div>
            </div>

            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('qrposter')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">🖨️ Printable QR poster</div>
                <span id="mq-mk-arrow-qrposter" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-qrposter" style="display:none;padding:0 1.25rem 1.25rem">
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">A print-ready poster with a QR code linking straight to your quote page — perfect for a sandwich board, front desk, or restroom poster. Walk-in customers just scan and go.</p>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1rem">
                <canvas id="mq-mk-qr-canvas" width="1080" height="1620" style="width:200px;height:300px;border-radius:10px;display:block"></canvas>
                <div style="width:100%;max-width:280px">
                  <label class="mq-label" style="display:block;margin-bottom:6px;font-size:11px">Headline text</label>
                  <input type="text" id="mq-mk-qr-headline" placeholder="Scan for an instant price" maxlength="60" style="font-size:13px"/>
                </div>
                <div style="width:100%;max-width:280px">
                  <label class="mq-label" style="display:block;margin-bottom:6px;font-size:11px">Headline font</label>
                  <select id="mq-mk-qr-font" style="font-size:13px;width:100%">
                    <option value="-apple-system, sans-serif">Default (System)</option>
                    <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica — Clean & Modern</option>
                    <option value="Georgia, serif">Georgia — Warm & Premium</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet — Friendly & Bold</option>
                    <option value="'Times New Roman', serif">Times New Roman — Classic</option>
                    <option value="Impact, 'Arial Narrow', sans-serif">Impact — Strong & Punchy</option>
                  </select>
                </div>
                <div style="width:100%;max-width:280px;align-items:center;gap:10px;display:flex">
                  <span style="font-size:11px;color:#6b7280;white-space:nowrap">Letter spacing</span>
                  <input type="range" id="mq-mk-qr-letter-spacing" min="0" max="20" value="0" style="flex:1"/>
                  <span style="font-size:11px;color:#6b7280;width:28px;text-align:right" id="mq-mk-qr-letter-spacing-val">0px</span>
                </div>
                <div style="width:100%;max-width:280px;display:flex;align-items:center;gap:10px">
                  <label class="mq-label" style="font-size:11px;white-space:nowrap;margin:0">Background colour</label>
                  <input type="color" id="mq-mk-qr-color" style="width:42px;height:32px;padding:2px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer"/>
                  <button class="mq-btn mq-btn-sm" id="mq-mk-qr-color-reset" style="flex-shrink:0">Reset</button>
                </div>
                <div style="display:flex;gap:8px;width:100%;max-width:280px">
                  <label class="mq-btn mq-btn-sm" style="flex:1;text-align:center;cursor:pointer">
                    📷 Add background photo
                    <input type="file" id="mq-mk-qr-bg-photo" accept="image/*" style="display:none"/>
                  </label>
                  <button class="mq-btn mq-btn-sm" id="mq-mk-qr-bg-remove" style="flex-shrink:0">✕</button>
                </div>
                <span style="font-size:11px;color:#9ca3af;text-align:center">Uses the link set at the top of this page — set it there if you haven't already</span>
                <div id="mq-mk-qr-overlay-row" style="display:none;width:100%;max-width:280px;align-items:center;gap:10px">
                  <span style="font-size:11px;color:#6b7280;white-space:nowrap">Darkness</span>
                  <input type="range" id="mq-mk-qr-overlay-slider" min="0" max="90" value="62" style="flex:1"/>
                  <span style="font-size:11px;color:#6b7280;width:28px;text-align:right" id="mq-mk-qr-overlay-val">62%</span>
                </div>
                <button class="mq-btn mq-btn-primary" id="mq-mk-qr-download-btn" style="width:100%;max-width:280px">⬇️ Download poster (PNG)</button>
              </div>
              </div>
            </div>


            <div class="mq-card" style="padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('whereto')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">📍 Where to post</div>
                <span id="mq-mk-arrow-whereto" style="font-size:13px;color:#9ca3af;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-whereto" style="display:none;padding:0 1.25rem 1.25rem">
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
            </div>

            <div class="mq-card" style="border-color:#86efac;background:#f0fdf4;padding:0;overflow:hidden">
              <div onclick="mqToggleMkSection('checklist')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
                <div class="mq-card-title" style="margin:0">✅ Pre-launch checklist</div>
                <span id="mq-mk-arrow-checklist" style="font-size:13px;color:#166534;transition:transform 0.2s">▼</span>
              </div>
              <div id="mq-mk-body-checklist" style="display:none;padding:0 1.25rem 1.25rem">
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
        priceId: 'prc_midasquote-annual-plan-hui0rv4',
      });
    } catch(e) {
      console.error('Upgrade error:', e);
      alert('Unable to open upgrade checkout. Please email support@midasquote.com to upgrade your plan.');
    }
  };

  // Used when a member's subscription has fully ended (not just scheduled to
  // cancel) — the Stripe Customer Portal has no "resubscribe" option in that
  // case, so we relaunch checkout directly via Memberstack instead.
  window.mqReactivate = async function(priceId) {
    try {
      await window.$memberstackDom.purchasePlansWithCheckout({
        priceId: priceId || 'prc_midasquote-monthly-plan-i7d0ryx',
      });
    } catch(e) {
      console.error('Reactivate error:', e);
      alert('Unable to open checkout. Please email support@midasquote.com to reactivate your plan.');
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

  window.mqUseShopInfoEmail = function() {
    const emailEl = document.getElementById('mq-support-email');
    const shopEmail = window._mqShopRecord?.fields['Lead notify email'];
    if (!emailEl) return;
    if (shopEmail) {
      emailEl.value = shopEmail;
    } else {
      const statusEl = document.getElementById('mq-support-status');
      if (statusEl) { statusEl.textContent = "No email found in Shop Info yet — you'll need to type one in."; statusEl.style.color = '#dc2626'; }
    }
  };

  window.mqSubmitSupport = async function() {
    const emailEl = document.getElementById('mq-support-email');
    const topicEl = document.getElementById('mq-support-topic');
    const messageEl = document.getElementById('mq-support-message');
    const statusEl = document.getElementById('mq-support-status');
    const btn = document.getElementById('mq-support-submit-btn');
    const email = (emailEl?.value || '').trim();
    const topic = topicEl?.value || 'Support';
    const message = (messageEl?.value || '').trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      if (statusEl) { statusEl.textContent = 'Please enter a valid email so we know where to reply.'; statusEl.style.color = '#dc2626'; }
      emailEl?.focus();
      return;
    }
    if (!message) {
      if (statusEl) { statusEl.textContent = 'Please enter a message first.'; statusEl.style.color = '#dc2626'; }
      return;
    }
    const shopRecord = window._mqShopRecord;
    const shopName = shopRecord?.fields['Shop name'] || 'Unknown shop';
    const shopToken = shopRecord?.fields['Shop token'] || 'unknown-token';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    if (statusEl) statusEl.textContent = '';
    try {
      const html = `
        <p><strong>Topic:</strong> ${topic}</p>
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Shop name:</strong> ${shopName}</p>
        <p><strong>Shop token:</strong> ${shopToken}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/</g,'&lt;').replace(/\n/g, '<br>')}</p>
      `;
      await fetch(CONFIG.EMAIL_WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'support@midasquote.com',
          replyTo: email, // so hitting "Reply" in your own inbox goes straight to them, not back to support@
          subject: `[${topic}] ${shopName}`,
          html
        })
      });
      if (statusEl) { statusEl.textContent = "✓ Sent! We'll get back to you soon."; statusEl.style.color = '#166534'; }
      if (messageEl) messageEl.value = '';
    } catch(e) {
      if (statusEl) { statusEl.textContent = 'Something went wrong sending that — please try again.'; statusEl.style.color = '#dc2626'; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
    }
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
  function mqFallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch(e) { return false; }
  }
  window.mqUpdateCombinedEmbed = function() {
    setTimeout(() => {
      const wantHeader = document.getElementById('mq-embed-chk-header')?.checked;
      const wantTrust  = document.getElementById('mq-embed-chk-trust')?.checked;
      const wantWidget = document.getElementById('mq-embed-chk-widget')?.checked;
      const headerCode = window._mqRawHeaderCode || '';
      const trustCode  = window._mqRawTrustCode  || '';
      const widgetCode = window._mqRawEmbedCode   || '';
      const parts = [];
      if (wantHeader && headerCode) parts.push(headerCode);
      if (wantTrust  && trustCode)  parts.push(trustCode);
      if (wantWidget && widgetCode) parts.push(widgetCode);
      let combined = '';
      if (parts.length) {
        combined = `<div style="max-width:900px;margin:0 auto">\n\n${parts.join('\n\n')}\n\n</div>`;
      }
      const display = document.getElementById('mq-combined-embed-display');
      if (display) display.textContent = combined || '— Select at least one item above —';
      window._mqRawCombinedEmbed = combined;

      // Update live preview
      const previewHeader = document.getElementById('mq-embed-preview-header');
      const previewTrust  = document.getElementById('mq-embed-preview-trust');
      const previewWidget = document.getElementById('mq-embed-preview-widget');
      if (previewHeader) previewHeader.innerHTML = (wantHeader && headerCode) ? headerCode : '';
      if (previewTrust)  previewTrust.innerHTML  = (wantTrust  && trustCode)  ? trustCode  : '';
      if (previewWidget) {
        previewWidget.style.display = wantWidget ? 'block' : 'none';
      }
    }, 10);
  };

  window.mqCopyCombinedEmbed = function(btn) {
    const code = window._mqRawCombinedEmbed || '';
    if (!code) { if (btn) { btn.textContent = 'Nothing selected!'; setTimeout(() => btn.textContent = '📋 Copy combined code', 2000); } return; }
    const ok   = () => { if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '📋 Copy combined code', 2000); } };
    const fail = () => { if (btn) { btn.textContent = 'Copy failed'; setTimeout(() => btn.textContent = '📋 Copy combined code', 2000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(ok).catch(() => { mqFallbackCopy(code) ? ok() : fail(); });
    } else { mqFallbackCopy(code) ? ok() : fail(); }
  };

  window.mqCopyEmbed = function(btn) {
    const code = window._mqRawEmbedCode || '';
    const ok = () => { if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); } };
    const fail = () => { if (btn) { btn.textContent = 'Copy failed'; setTimeout(() => btn.textContent = 'Copy', 2000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(ok).catch(() => { mqFallbackCopy(code) ? ok() : fail(); });
    } else {
      mqFallbackCopy(code) ? ok() : fail();
    }
  };
  window.mqCopyText = function(text, btn) {
    const ok = () => { if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); } };
    const fail = () => { if (btn) { btn.textContent = 'Copy failed'; setTimeout(() => btn.textContent = 'Copy', 2000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() => { mqFallbackCopy(text) ? ok() : fail(); });
    } else {
      mqFallbackCopy(text) ? ok() : fail();
    }
  };

  // Shared "Add to Home Screen" instructions — identical for both the Direct
  // Link and MidasQuote Pro sections, since the steps themselves don't
  // depend on which link is being added, just kept as one function so the
  // two sections can't drift out of sync with each other.
  function mqAddToHomescreenInstructionsHTML() {
    return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">

    <div style="background:#f9fafb;border-radius:8px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px">🍎 iPhone / iPad (Safari)</div>
      <ol style="font-size:12.5px;color:#4b5563;line-height:1.7;padding-left:18px;margin:0">
        <li>Open your direct link in Safari</li>
        <li>Tap the <strong>Share</strong> icon (square with an arrow)</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
        <li>Tap <strong>Add</strong> — done!</li>
      </ol>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px">🤖 Android</div>
      <p style="font-size:11.5px;color:#6b7280;margin-bottom:8px;line-height:1.5">Steps vary a bit by phone brand — Samsung phones especially use a different browser by default.</p>
      <div style="font-size:12.5px;font-weight:600;color:#374151;margin-bottom:4px">In Chrome:</div>
      <ol style="font-size:12.5px;color:#4b5563;line-height:1.7;padding-left:18px;margin:0 0 10px">
        <li>Open your direct link in Chrome</li>
        <li>Tap the <strong>⋮</strong> menu (top right)</li>
        <li>Tap <strong>Add to Home screen</strong> — not "Add to Favorites" (that's a bookmark, not a homescreen icon)</li>
        <li>Confirm — done!</li>
      </ol>
      <div style="font-size:12.5px;font-weight:600;color:#374151;margin-bottom:4px">On Samsung phones (Samsung Internet browser):</div>
      <ol style="font-size:12.5px;color:#4b5563;line-height:1.7;padding-left:18px;margin:0">
        <li>Tap the menu icon (bottom right)</li>
        <li>Tap <strong>Add page to</strong> → <strong>Home screen</strong></li>
      </ol>
      <p style="font-size:11px;color:#9ca3af;margin-top:8px;line-height:1.5">Don't see the icon right away? Check your app drawer too — some phones add it there first.</p>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px">💻 Desktop (Chrome)</div>
      <ol style="font-size:12.5px;color:#4b5563;line-height:1.7;padding-left:18px;margin:0">
        <li>Open your direct link in Chrome</li>
        <li>Click the <strong>⋮</strong> menu (top right)</li>
        <li>Go to <strong>Cast, save, and share</strong></li>
        <li>Click <strong>Install as app</strong></li>
        <li>Confirm — it now opens like a regular app</li>
      </ol>
    </div>

  </div>`;
  }

  // Collapsible sections on the Embed page ("Code for websites" / "Direct
  // link" / "MidasQuote Pro") — same idea as the widget's own collapsible
  // sections, just a small self-contained version for this one page.
  window.mqToggleEmbedSection = function(key) {
    const body = document.getElementById(`mq-embed-${key}-body`);
    const arrow = document.getElementById(`mq-embed-${key}-arrow`);
    if (!body) return;
    const opening = body.style.display === 'none';
    body.style.display = opening ? 'block' : 'none';
    if (arrow) arrow.style.transform = opening ? 'rotate(90deg)' : 'rotate(0deg)';
  };

  // ============================================================
  // IMAGE UPLOAD — permanent hosting via Cloudflare R2 (replaces fragile pasted links)
  // ============================================================
  async function mqUploadImage(file, shopToken, category) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('shopToken', shopToken || 'unknown-shop');
    formData.append('category', category || 'general');
    const res = await fetch(CONFIG.IMAGE_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CONFIG.IMAGE_UPLOAD_SECRET}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }
    return data.url;
  }

  // Wires a hidden file input + visible "Upload photo" button to actually upload and
  // fill the given target URL input field once done. Shows inline status feedback.
  function mqWireUploadButton(uploadBtnId, fileInputId, statusElId, targetInputId, shopToken, category, onDone) {
    const uploadBtn = uploadBtnId ? document.getElementById(uploadBtnId) : null;
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusElId);
    const targetInput = document.getElementById(targetInputId);
    if (!fileInput) return;

    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (statusEl) { statusEl.textContent = 'Uploading…'; statusEl.style.color = '#6b7280'; }
      fileInput.disabled = true;
      if (uploadBtn) uploadBtn.disabled = true;
      try {
        const url = await mqUploadImage(file, shopToken, category);
        if (targetInput) targetInput.value = url;
        if (statusEl) { statusEl.textContent = '✓ Uploaded!'; statusEl.style.color = '#16a34a'; }
        if (typeof onDone === 'function') onDone(url);
      } catch (e) {
        if (statusEl) { statusEl.textContent = 'Upload failed — try again'; statusEl.style.color = '#dc2626'; }
      } finally {
        fileInput.disabled = false;
        if (uploadBtn) uploadBtn.disabled = false;
        fileInput.value = '';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
      }
    };
  }

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
    { name:'Single garbage pullout',     price:0,  perFt:false, sort:1 },
    { name:'Lazy Susan',                 price:0,  perFt:false, sort:2 },
    { name:'10x10 Glass door inserts',   price:0,  perFt:false, sort:3 },
    { name:'Tall cabinet with pullouts', price:0,  perFt:false, sort:4 },
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

  // Refacing/Repainting/Restaining come with these specialty items pre-built,
  // each tagged so they only show for their matching project type. Runs once
  // per shop, gated by its own 'Templates seeded' flag — independent of
  // ensureSpecialtyDefaults above, since shops that already have OTHER
  // specialty items should still get these new templates.
  const PROJECT_TYPE_TEMPLATES = {
    refacing: [
      { name:'New doors',              price:0, perFt:false, perSqFt:true  },
      { name:'New drawer fronts',      price:0, perFt:false, perSqFt:true  },
      { name:'Edge tape replacement',  price:0, perFt:true,  perSqFt:false },
      { name:'Hinge replacement',      price:0, perFt:false, perSqFt:false },
    ],
    repainting: [
      { name:'Door & drawer front painting', price:0, perFt:false, perSqFt:true  },
      { name:'Edge tape painting',           price:0, perFt:true,  perSqFt:false },
    ],
    restaining: [
      { name:'Door & drawer front restaining', price:0, perFt:false, perSqFt:true  },
      { name:'Edge tape restaining',           price:0, perFt:true,  perSqFt:false },
    ],
  };

  // Name of the special reserved shop record that holds the master template
  // specialty items. Never shown to real customers — just an anchor for
  // linked-record storage, same shape as any other shop.
  const MASTER_TEMPLATE_SHOP_NAME = 'MASTER_TEMPLATE';

  async function ensureMasterTemplateShop() {
    if (window._mqMasterTemplateShop) return window._mqMasterTemplateShop;
    const existing = await atGet(CONFIG.SHOPS_TABLE, `{Shop name} = "${MASTER_TEMPLATE_SHOP_NAME}"`);
    if (existing.length) { window._mqMasterTemplateShop = existing[0]; return existing[0]; }
    // No Status set — this reserved record never goes through the normal
    // active/trial/cancelled lifecycle, so there's no valid value that fits.
    const created = await atCreate(CONFIG.SHOPS_TABLE, { 'Shop name': MASTER_TEMPLATE_SHOP_NAME });
    if (!created?.id) {
      console.error('Failed to create master template shop:', created);
      throw new Error('Could not create the master template shop record — check the browser console for the exact Airtable error.');
    }
    window._mqMasterTemplateShop = created;
    return created;
  }

  // Ensures the master template shop actually has its starter items —
  // decoupled from ensureProjectTypeTemplates (which only runs for a shop
  // that's never been seeded) so this self-heals every time the admin visits
  // the Templates tab, even if the admin's own shop was seeded long before
  // this feature existed.
  async function ensureMasterTemplateItems() {
    const masterShop = await ensureMasterTemplateShop();
    let masterItems = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${MASTER_TEMPLATE_SHOP_NAME}", ARRAYJOIN({Shop}))`);

    // Bootstrap starter items per project type (refacing/repainting/
    // restaining) independently — not all-or-nothing on the whole master
    // shop. Otherwise the moment ANY item exists (even one totally
    // unrelated to these three), the starters for a project type that
    // still has zero items of its own would never get created at all.
    const existingRoomIds = new Set();
    masterItems.forEach(item => {
      try {
        (JSON.parse(item.fields['Visible rooms'] || '[]')).forEach(r => existingRoomIds.add(r));
      } catch(e) { /* malformed Visible rooms on an existing item — skip it */ }
    });
    const missingEntries = Object.entries(PROJECT_TYPE_TEMPLATES).filter(([roomId]) => !existingRoomIds.has(roomId));
    if (!missingEntries.length) return masterItems;

    const bootstrapItems = missingEntries.flatMap(([roomId, items]) =>
      items.map(item => ({ ...item, roomId }))
    );
    const results = await Promise.all(bootstrapItems.map(item => atCreate(CONFIG.SPECIALTY_TABLE, {
      'Shop': [masterShop.id],
      'Item name': item.name,
      'Special Items': item.name,
      'Price': item.price,
      'Per linear foot': item.perFt,
      'Per square foot': item.perSqFt,
      'Active': true,
      'Visible rooms': JSON.stringify([item.roomId]),
    })));
    const failed = results.filter(r => !r?.id);
    if (failed.length) console.error('Some master template items failed to create:', failed);
    masterItems = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${MASTER_TEMPLATE_SHOP_NAME}", ARRAYJOIN({Shop}))`);
    return masterItems;
  }

  // Default project type definitions (name/description/adjustment) for
  // Refacing/Repainting/Restaining, now editable via the admin Templates
  // page instead of being hardcoded here. Bootstraps the master shop's own
  // Room types field once from these starting values if it's never been set.
  const DEFAULT_TEMPLATE_ROOM_DEFS = {
    refacing:   { id:'refacing',   name:'Refacing',    materialAdjPct:0, installAdjPct:0, totalAdjPct:0, description:'Love your layout, just not the look? Refacing gives your cabinets a whole new personality — new doors, drawer fronts, crown, and valance — without the cost or mess of a full remodel.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/refacing.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/refacing.png' },
    repainting: { id:'repainting', name:'Repainting',  materialAdjPct:0, installAdjPct:0, totalAdjPct:0, description:'Sometimes all it takes is a fresh coat. Give your existing cabinets new color and new life, without replacing a thing.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/repainting.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/repainting.png' },
    restaining: { id:'restaining', name:'Restaining',  materialAdjPct:0, installAdjPct:0, totalAdjPct:0, description:'Bring back the natural beauty of your cabinets. A fresh stain can restore that warm, rich look you fell in love with in the first place.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/restaining.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/restaining.png' },
  };

  async function ensureMasterTemplateRoomDefs() {
    const masterShop = await ensureMasterTemplateShop();
    let masterRooms = [];
    try { masterRooms = masterShop.fields['Room types'] ? JSON.parse(masterShop.fields['Room types']) : []; } catch(e) { masterRooms = []; }
    if (masterRooms.length) return masterRooms;
    // Never set before — bootstrap from the starting values above
    masterRooms = Object.values(DEFAULT_TEMPLATE_ROOM_DEFS);
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, masterShop.id, { 'Room types': JSON.stringify(masterRooms) });
      masterShop.fields['Room types'] = JSON.stringify(masterRooms);
    } catch(e) { console.warn('Failed to bootstrap master template room defs:', e); }
    return masterRooms;
  }

  async function renderMasterRoomDefs() {
    const masterRooms = await ensureMasterTemplateRoomDefs();
    window._mqMasterRooms = masterRooms;
    const content = document.getElementById('mq-master-rooms-content');
    if (!content) return;
    content.innerHTML = masterRooms.map((r, idx) => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px">
        <input type="text" value="${(r.name||'').replace(/"/g,'&quot;')}" id="mq-master-room-name-${idx}" placeholder="Project type name" style="font-size:13px;font-weight:600;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"/>
        <textarea id="mq-master-room-desc-${idx}" placeholder="Description shown to customers on the widget for this project type" rows="3" style="width:100%;font-size:12px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;resize:vertical;margin-bottom:8px">${(r.description||'').replace(/</g,'&lt;')}</textarea>
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px">
          <div id="mq-master-room-cover-preview-${idx}" style="width:56px;height:56px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
            ${r.coverImage ? `<img src="${r.coverImage}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>` : '<span style="font-size:20px">🖼️</span>'}
          </div>
          <div style="flex:1;min-width:0">
            <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Default cover image — new shops start with this; they can change it afterward</label>
            <input type="text" id="mq-master-room-cover-${idx}" value="${(r.coverImage||'').replace(/"/g,'&quot;')}" placeholder="https://your-site.com/photo.jpg" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:4px"/>
            <label class="mq-btn mq-btn-sm" style="font-size:11px;cursor:pointer;display:inline-block">
              📤 Upload
              <input type="file" id="mq-master-room-cover-file-${idx}" accept="image/*" style="display:none"/>
            </label>
            <span id="mq-master-room-cover-status-${idx}" style="font-size:11px;margin-left:6px"></span>
          </div>
        </div>
        <div style="border-top:1px dashed #e5e7eb;padding-top:10px">
          <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">📏 Default "How to measure your space" for this project type</label>
          <textarea id="mq-master-room-measure-text-${idx}" placeholder="Leave blank to use the standard measuring guide. New shops (and any shop that gets this project type added later) start with whatever's here." rows="3" style="width:100%;font-size:12px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;resize:vertical;margin-bottom:6px">${(r.measureText||'').replace(/</g,'&lt;')}</textarea>
          <div style="margin-bottom:8px">
            <button type="button" class="mq-btn mq-btn-sm" style="font-size:11px" onclick="mqFillDefaultGuide('mq-master-room-measure-text-${idx}','${r.id}')">↺ Use default guide</button>
            <span style="font-size:11px;color:#9ca3af;margin-left:6px">Tip: **text** shows as bold, [calc] shows the calculator icon, [corner-img] shows the corner-cabinets photo, [tip]text[/tip] wraps it in a yellow callout box</span>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-start">
            <div id="mq-master-room-measure-img-preview-${idx}" style="width:56px;height:56px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
              ${r.measureImage ? `<img src="${r.measureImage}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>` : '<span style="font-size:20px">📏</span>'}
            </div>
            <div style="flex:1;min-width:0">
              <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Default measuring guide image (optional)</label>
              <input type="text" id="mq-master-room-measure-img-${idx}" value="${(r.measureImage||'').replace(/"/g,'&quot;')}" placeholder="https://your-site.com/how-to-measure.jpg" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:4px"/>
              <label class="mq-btn mq-btn-sm" style="font-size:11px;cursor:pointer;display:inline-block">
                📤 Upload
                <input type="file" id="mq-master-room-measure-img-file-${idx}" accept="image/*" style="display:none"/>
              </label>
              <span id="mq-master-room-measure-img-status-${idx}" style="font-size:11px;margin-left:6px"></span>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    masterRooms.forEach((r, idx) => {
      mqWireUploadButton(
        null,
        `mq-master-room-cover-file-${idx}`,
        `mq-master-room-cover-status-${idx}`,
        `mq-master-room-cover-${idx}`,
        MASTER_TEMPLATE_SHOP_NAME,
        'products',
        (url) => {
          const preview = document.getElementById(`mq-master-room-cover-preview-${idx}`);
          if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          mqSaveMasterRoomDefs();
        }
      );
      mqWireUploadButton(
        null,
        `mq-master-room-measure-img-file-${idx}`,
        `mq-master-room-measure-img-status-${idx}`,
        `mq-master-room-measure-img-${idx}`,
        MASTER_TEMPLATE_SHOP_NAME,
        'products',
        (url) => {
          const preview = document.getElementById(`mq-master-room-measure-img-preview-${idx}`);
          if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          mqSaveMasterRoomDefs();
        }
      );
    });
  }

  window.mqSaveMasterRoomDefs = async function() {
    const masterShop = await ensureMasterTemplateShop();
    const current = window._mqMasterRooms || [];
    const updated = current.map((r, idx) => ({
      ...r,
      name: (el(`mq-master-room-name-${idx}`)?.value || r.name || '').trim(),
      description: (el(`mq-master-room-desc-${idx}`)?.value || '').trim(),
      coverImage: (el(`mq-master-room-cover-${idx}`)?.value || '').trim(),
      measureText: (el(`mq-master-room-measure-text-${idx}`)?.value || '').trim(),
      measureImage: (el(`mq-master-room-measure-img-${idx}`)?.value || '').trim(),
    }));
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, masterShop.id, { 'Room types': JSON.stringify(updated) });
      masterShop.fields['Room types'] = JSON.stringify(updated);
      window._mqMasterRooms = updated;
      showMsg('mq-templates-msg', '✓ Default project type descriptions saved — this only affects shops seeded from now on.');
    } catch(e) {
      console.error('Failed to save master room defs:', e);
      showMsg('mq-templates-msg', 'Error saving — please try again.', 'error');
    }
  };

  async function ensureProjectTypeTemplates(shopRecord) {
    if (shopRecord.fields['Templates seeded']) return; // already done for this shop

    // Make sure Refacing/Repainting/Restaining actually exist in the room
    // list too — not just their specialty items — otherwise a shop that
    // already customized their rooms before this feature existed would end
    // up with specialty items tagged to project types that aren't even in
    // their dropdown. Pulled from the editable master template room defs,
    // not hardcoded, so editing them on the admin Templates page actually
    // changes what new shops get.
    const templateRoomList = await ensureMasterTemplateRoomDefs();
    const currentRooms = window._mqRooms || defaultRoomTypes();
    let roomsChanged = false;
    templateRoomList.forEach(roomDef => {
      if (!currentRooms.find(r => r.id === roomDef.id)) {
        currentRooms.push(roomDef);
        roomsChanged = true;
      }
    });
    if (roomsChanged) {
      window._mqRooms = currentRooms;
      try {
        await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Room types': JSON.stringify(currentRooms) });
        shopRecord.fields['Room types'] = JSON.stringify(currentRooms);
        renderRoomsList();
      } catch(e) { console.warn('Failed to add project type template rooms:', e); }
    }

    const masterItems = await ensureMasterTemplateItems();

    // Master items can have their own reference photos (uploaded on the
    // Templates page) — those need to carry over to this shop's copies too,
    // not just the text/price/settings. Computed locally as one combined
    // write at the end rather than per-item, since these all run in
    // parallel — writing the shop's Photos field concurrently per-item
    // would risk one write clobbering another's.
    const masterShop = await ensureMasterTemplateShop();
    let masterPhotos = {};
    try { masterPhotos = masterShop.fields['Photos'] ? JSON.parse(masterShop.fields['Photos']) : {}; } catch(e) {}
    const shopPhotos = {};
    try { Object.assign(shopPhotos, shopRecord.fields['Photos'] ? JSON.parse(shopRecord.fields['Photos']) : {}); } catch(e) {}
    let photosChanged = false;

    try {
      await Promise.all(masterItems.map(async master => {
        const created = await atCreate(CONFIG.SPECIALTY_TABLE, {
          'Shop': [shopRecord.id],
          'Item name': master.fields['Item name'],
          'Special Items': master.fields['Item name'],
          'Price': master.fields['Price'] || 0,
          'Per linear foot': master.fields['Per linear foot'] || false,
          'Per square foot': master.fields['Per square foot'] || false,
          'Offers install choice': master.fields['Offers install choice'] || false,
          'Install price': master.fields['Install price'] || 0,
          'Install mode': master.fields['Install mode'] || 'supply',
          'Description': master.fields['Description'] || '',
          'Category': master.fields['Category'] || '',
          'Pro only': master.fields['Pro only'] || false,
          'Active': true,
          'Visible rooms': master.fields['Visible rooms'] || '[]',
          'Template source ID': master.id,
        });
        if (created?.id) {
          const photoUrl = masterPhotos['spec_' + master.id];
          if (photoUrl) { shopPhotos['spec_' + created.id] = photoUrl; photosChanged = true; }
        }
        return created;
      }));
      if (photosChanged) {
        await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Photos': JSON.stringify(shopPhotos) });
        shopRecord.fields['Photos'] = JSON.stringify(shopPhotos);
      }
      await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Templates seeded': true });
      shopRecord.fields['Templates seeded'] = true;
    } catch(e) { console.warn('Failed to seed project type templates:', e); }
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
    {
      const swatch = el('mq-shop-color-swatch');
      const textField = el('mq-shop-color');
      const loadedColor = f['Brand colour'];
      if (swatch) {
        swatch.value = /^#[0-9a-fA-F]{6}$/.test(loadedColor) ? loadedColor : '#1a1a1a';
        // Wire bidirectional sync once — guard against duplicate listeners if
        // populateShop runs again (e.g. after a save/reload cycle).
        if (swatch && !swatch.dataset.mqWired) {
          swatch.dataset.mqWired = '1';
          swatch.addEventListener('input', () => { if (textField) textField.value = swatch.value; });
          if (textField) {
            textField.addEventListener('input', () => {
              if (/^#[0-9a-fA-F]{6}$/.test(textField.value)) swatch.value = textField.value;
            });
          }
        }
      }
    }
    set('mq-shop-range-low',  f['Quote range low']  || '10');
    set('mq-shop-range-high', f['Quote range high'] || '15');
    set('mq-shop-logo', f['Logo URL']);
    mqRefreshLogoPreview();
    mqWireUploadButton(
      null,
      'mq-shop-logo-file',
      'mq-shop-logo-upload-status',
      'mq-shop-logo',
      (window._mqShopRecord && window._mqShopRecord.fields && window._mqShopRecord.fields['Shop token']) || 'unknown-shop',
      'logos',
      async (url) => {
        mqRefreshLogoPreview();
        const shopRec = window._mqShopRecord;
        if (shopRec) {
          try {
            await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Logo URL': url });
            shopRec.fields['Logo URL'] = url;
            showMsg('mq-shop-msg', '✓ Logo uploaded and saved!');
          } catch(e) { showMsg('mq-shop-msg', 'Logo uploaded but save failed — click Save shop info to retry.', 'error'); }
        }
      }
    );
    set('mq-shop-disclaimer', f['Disclaimer text']);
    set('mq-shop-consult-link', f['Consultation link']);
    set('mq-shop-consult-email', f['Consultation email']);
    window.mqCheckConsultFields = function() {
      const link = el('mq-shop-consult-link')?.value?.trim() || '';
      const email = el('mq-shop-consult-email')?.value?.trim() || '';
      const warning = el('mq-shop-consult-warning');
      if (warning) warning.style.display = (!link && !email) ? 'block' : 'none';
    };
    window.mqCheckConsultFields();
    const toggle = el('mq-showroom-toggle');
    if (toggle) {
      // Matches the widget's own check (shop['Show showroom'] !== 'Hide') —
      // this used to check for the boolean `false` instead, which could
      // never match the string actually being saved, making the toggle show
      // the wrong state on every reload regardless of what was set.
      const isOn = f['Show showroom'] !== 'Hide';
      toggle.classList.toggle('on', isOn);
    }
    const financingToggle = el('mq-financing-toggle');
    const financingLinkWrap = el('mq-financing-link-wrap');
    if (financingToggle) {
      // Matches the widget's own check (shop['Offers financing'] === 'Yes')
      // — same issue as showroom above, this was checking for a boolean
      // `true` that was never actually what got saved.
      const isOn = f['Offers financing'] === 'Yes';
      financingToggle.classList.toggle('on', isOn);
      if (financingLinkWrap) financingLinkWrap.style.display = isOn ? 'block' : 'none';
    }
    set('mq-financing-link', f['Financing link']);

    // ── Autosave: fire mqSaveShop 1.5s after the user stops editing any field ──
    let _shopAutoSaveTimer = null;
    const shopAutoSave = () => {
      clearTimeout(_shopAutoSaveTimer);
      showMsg('mq-shop-msg', '…saving');
      _shopAutoSaveTimer = setTimeout(() => { window.mqSaveShop(); }, 1500);
    };
    const shopFieldIds = [
      'mq-shop-name','mq-shop-phone','mq-shop-city','mq-shop-website',
      'mq-shop-email','mq-shop-color','mq-shop-range-low','mq-shop-range-high',
      'mq-shop-logo','mq-shop-disclaimer','mq-shop-consult-link',
      'mq-shop-consult-email','mq-financing-link'
    ];
    shopFieldIds.forEach(id => {
      const field = el(id);
      if (field) field.addEventListener('input', shopAutoSave);
    });
    const swatch = el('mq-shop-color-swatch');
    if (swatch) swatch.addEventListener('change', shopAutoSave);
  }

  // ============================================================
  // ROOM TYPES
  // ============================================================
  // Same 6 defaults the widget falls back to for any shop that hasn't
  // touched this new setting yet — Bathroom ships pre-set to -5% as a
  // working example, everything else fully editable/deletable.
  // Plain category display names, accessible at module level (unlike
  // CAT_DISPLAY, which is scoped inside initProductsTab and includes emoji/
  // title formatting we don't need here).
  const CAT_DISPLAY_NAMES = {
    material: 'Box Materials',
    door: 'Door Styles',
    drawer: 'Drawer Configurations',
    hinge: 'Door Hinges',
    countertop: 'Countertop Materials',
    trim_crown: 'Crown Moulding',
    trim_valance: 'Valance',
    tall_cabinet: 'Tall Cabinets',
    specialty: 'Specialty Items',
  };

  // Same wording as the widget's hardcoded fallback guide (defaultMeasureGuideHTML
  // in widgettestcats.js), just written in the **bold**/line-break plain-text
  // form a shop owner can start from and edit. Used by the "Use default guide"
  // button in both the per-shop Project Types tab and the admin Templates tab.
  // Kitchen gets its own wording (island + corner cabinets called out
  // specifically); Bathroom skips the corner-cabinets note (not common
  // enough there to be worth the extra line); everything else uses the
  // general version, which includes it.
  const DEFAULT_MEASURE_GUIDE_TEXT_KITCHEN =
`**Upper cabinets:** Stand at one end of the wall where your uppers will go and measure straight across to the other end. Write that number down in feet.

**Base cabinets:** Same thing — measure the total wall length where your base cabinets will sit.

**Island cabinets:** Include island cabinets if you have one.

**Corner cabinets:** At each corner, measure one wall all the way in, then stop the other wall short of the corner — about 1 foot for upper cabinets, about 2 feet for base cabinets, since that's roughly where the corner cabinet already covers the space either way. Don't worry about the exact number, this is a ballpark estimate.
[corner-img]

[tip]**Don't feel like converting inches or mm?** Tap the [calc] next to the field and it'll convert it for you.[/tip]`;

  const DEFAULT_MEASURE_GUIDE_TEXT_GENERAL =
`**Upper cabinets:** Stand at one end of the wall where your uppers will go and measure straight across to the other end. Write that number down in feet.

**Base cabinets:** Same thing — measure the total wall length where your base cabinets will sit.

**Not sure?** Just use your best guess — this is a ballpark estimate!

**Tip:** measure in feet, not inches. If your wall is 12 feet and 6 inches wide, enter 12.5.

**Corner cabinets:** At each corner, measure one wall all the way in, then stop the other wall short of the corner — about 1 foot for upper cabinets, about 2 feet for base cabinets, since that's roughly where the corner cabinet already covers the space either way. Don't worry about the exact number, this is a ballpark estimate.
[corner-img]

[tip]**Don't feel like converting inches or mm?** Tap the [calc] next to the field and it'll convert it for you.[/tip]`;

  const DEFAULT_MEASURE_GUIDE_TEXT_BATHROOM =
`**Upper cabinets:** Stand at one end of the wall where your uppers will go and measure straight across to the other end. Write that number down in feet.

**Base cabinets:** Same thing — measure the total wall length where your base cabinets will sit.

**Not sure?** Just use your best guess — this is a ballpark estimate!

**Tip:** measure in feet, not inches. If your wall is 12 feet and 6 inches wide, enter 12.5.

[tip]**Don't feel like converting inches or mm?** Tap the [calc] next to the field and it'll convert it for you.[/tip]`;

  // Fills a measure-guide textarea with the default text above — lets a shop
  // owner start from (and edit) the standard guide instead of writing their
  // own from scratch. Confirms first if the box already has something in it,
  // so a stray click can't silently wipe out real custom text.
  window.mqFillDefaultGuide = function(textareaId, roomId) {
    const ta = el(textareaId);
    if (!ta) return;
    if (ta.value.trim() && !confirm('Replace what\'s in this box with the default guide text?')) return;
    ta.value = roomId === 'kitchen' ? DEFAULT_MEASURE_GUIDE_TEXT_KITCHEN
      : roomId === 'bathroom' ? DEFAULT_MEASURE_GUIDE_TEXT_BATHROOM
      : DEFAULT_MEASURE_GUIDE_TEXT_GENERAL;
  };

  const MQ_DEFAULT_MEASURE_IMAGE_BASE = 'https://aceswin.github.io/midasquote-widget/measure-guides/';
  const MQ_DEFAULT_COVER_IMAGE_BASE = 'https://aceswin.github.io/midasquote-widget/cover-images/';

  function defaultRoomTypes() {
    return [
      { id:'kitchen', name:'Kitchen',        materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'The kitchen is where life happens — let\'s build one you\'ll love spending time in. Pick your cabinets, doors, and finishes, and watch your dream kitchen take shape.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'kitchen.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'kitchen.png' },
      { id:'bathroom',name:'Bathroom',       materialAdjPct:-5, installAdjPct:0, totalAdjPct:0, description:'Turn your bathroom into a personal retreat. Choose the vanity and finishes that make getting ready each morning feel a little more special.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'bathroom.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'bathroom.png' },
      { id:'laundry', name:'Laundry room',   materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Even the laundry room deserves some love. Add smart, good-looking storage that makes everyday chores feel a lot less like chores.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'laundry.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'laundry.png' },
      { id:'garage',  name:'Garage',         materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'From tools to hobbies to overflow storage — give your garage the organized, great-looking upgrade it\'s been waiting for.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'garage.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'garage.png' },
      { id:'commercial', name:'Commercial',  materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Make a great first impression. Get cabinetry built to fit your business, whether it\'s a sleek office or a welcoming retail space.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'commercial.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'commercial.png' },
      { id:'other',   name:'Other',          materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Got a project that doesn\'t quite fit the mold? We love a good challenge — let\'s bring your vision to life.', active:true, coverImage:MQ_DEFAULT_COVER_IMAGE_BASE+'other.png', measureText:'', measureImage:MQ_DEFAULT_MEASURE_IMAGE_BASE+'other.png' },
      { id:'refacing',   name:'Refacing',    materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Love your layout, just not the look? Refacing gives your cabinets a whole new personality — new doors, drawer fronts, crown, and valance — without the cost or mess of a full remodel.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/refacing.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/refacing.png' },
      { id:'repainting', name:'Repainting',  materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Sometimes all it takes is a fresh coat. Give your existing cabinets new color and new life, without replacing a thing.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/repainting.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/repainting.png' },
      { id:'restaining', name:'Restaining',  materialAdjPct:0, installAdjPct:0, totalAdjPct:0,  description:'Bring back the natural beauty of your cabinets. A fresh stain can restore that warm, rich look you fell in love with in the first place.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/restaining.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/restaining.png' },
    ];
  }

  function populateRooms(shop) {
    const f = shop.fields;
    let rooms = [];
    try { rooms = f['Room types'] ? JSON.parse(f['Room types']) : []; } catch(e) { rooms = []; }
    if (!Array.isArray(rooms) || !rooms.length) rooms = defaultRoomTypes();
    window._mqRooms = rooms;
    renderRoomsList();

    // Category-level hiding: which project types each WHOLE category is
    // hidden for (e.g. hide all Door Styles for "Door refacing"). Individual
    // item settings still override this — see categoryRoomDisclosure below.
    let categoryRooms = {};
    try { categoryRooms = f['Category rooms'] ? JSON.parse(f['Category rooms']) : {}; } catch(e) { categoryRooms = {}; }
    window._mqCategoryRooms = categoryRooms;
  }

  // Tracks which project types are currently expanded, keyed by the room's
  // stable id (not array index, since index shifts on reorder/delete) — so
  // expand/collapse state survives re-renders (e.g. every time you save).
  let _mqExpandedRoomIds = new Set();

  window.mqToggleRoomBody = function(idx) {
    const room = (window._mqRooms || [])[idx];
    if (!room) return;
    const body = el(`mq-room-body-${idx}`);
    const arrow = el(`mq-room-arrow-${idx}`);
    if (!body) return;
    const opening = body.style.display === 'none';
    body.style.display = opening ? 'block' : 'none';
    if (arrow) arrow.style.transform = opening ? 'rotate(90deg)' : 'rotate(0deg)';
    body.closest('.mq-room-row')?.classList.toggle('mq-room-open', opening);
    if (opening) _mqExpandedRoomIds.add(room.id); else _mqExpandedRoomIds.delete(room.id);
  };

  // One checkbox+percent row for a project type's price adjustments. The
  // checkbox is just a friendly on/off — checked means "value !== 0", and
  // unchecking zeroes it out (same convention as "0 = no adjustment"
  // everywhere else in this app, just given a clearer on/off affordance
  // here since a shop owner can now stack up to three of these at once).
  function mqRoomAdjRow(kind, idx, value, label, hint) {
    const inputId = `mq-room-adj-${kind}-${idx}`;
    const chkId = `mq-room-adj-${kind}-chk-${idx}`;
    const checked = parseFloat(value) !== 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="checkbox" id="${chkId}" ${checked?'checked':''} onchange="mqToggleRoomAdjInput(${idx},'${kind}')" style="width:auto;flex-shrink:0"/>
        <label for="${inputId}" style="font-size:12px;color:#374151;flex:1;min-width:0">${label} <span style="color:#9ca3af">— ${hint}</span></label>
        <input type="number" id="${inputId}" value="${value || 0}" step="0.5" onchange="mqSaveRooms()" style="width:60px;font-size:12px;padding:5px 6px;border:1px solid #d1d5db;border-radius:4px;font-family:inherit;text-align:center;flex-shrink:0"/>
        <span style="font-size:12px;color:#6b7280;flex-shrink:0">%</span>
      </div>`;
  }
  window.mqToggleRoomAdjInput = function(idx, kind) {
    const chk = el(`mq-room-adj-${kind}-chk-${idx}`);
    const inp = el(`mq-room-adj-${kind}-${idx}`);
    if (!chk || !inp) return;
    if (!chk.checked) { inp.value = 0; }
    else if (parseFloat(inp.value) === 0) { inp.value = 0; inp.focus(); }
    mqSaveRooms();
  };

  function renderRoomsList() {
    const container = el('mq-rooms-list');
    if (!container) return;
    const rooms = window._mqRooms || [];
    container.innerHTML = rooms.map((r, idx) => {
      const isOpen = _mqExpandedRoomIds.has(r.id);
      return `
      <div class="mq-room-row${isOpen?' mq-room-open':''}" data-idx="${idx}" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px${r.active===false?';opacity:0.6':''}">
        <div style="display:grid;grid-template-columns:24px 1fr 32px 40px;gap:10px;align-items:center;margin-bottom:8px">
          <span class="mq-room-drag-handle" style="cursor:grab;color:#9ca3af;font-size:16px;text-align:center">⠿</span>
          <input type="text" value="${(r.name||'').replace(/"/g,'&quot;')}" id="mq-room-name-${idx}" placeholder="Project name" style="font-size:13px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
          <button type="button" onclick="mqToggleRoomBody(${idx})" title="Show more" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;padding:4px">
            <span id="mq-room-arrow-${idx}" style="display:inline-block;transition:transform 0.2s;font-size:12px;transform:rotate(${isOpen?'90':'0'}deg)">▶</span>
          </button>
          <button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqRemoveRoom(${idx})" title="Delete room">✕</button>
        </div>
        <div id="mq-room-body-${idx}" style="padding-left:34px;display:${isOpen?'block':'none'}">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:${r.active===false?'#92400e':'#166534'};font-weight:600;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" id="mq-room-active-${idx}" ${r.active!==false?'checked':''} onchange="mqSaveRooms()" style="width:auto"/>
            ${r.active!==false ? '✓ Live on widget' : '🚧 Draft — hidden from widget while you set it up'}
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" id="mq-room-proonly-${idx}" ${r.proOnly?'checked':''} onchange="mqSaveRooms()" style="width:auto"/>
            ⚡ Only show in MidasQuote Pro <span style="font-weight:400;color:#9ca3af">(hidden from the customer-facing widget entirely)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" id="mq-room-hidemeasure-${idx}" ${r.hideMeasureGuide?'checked':''} onchange="mqSaveRooms()" style="width:auto"/>
            📏 Hide "How to measure" section <span style="font-weight:400;color:#9ca3af">(for project types that are flat-rate only, with nothing to measure)</span>
          </label>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:10px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:8px">💰 Price adjustments for this project type</label>
            ${mqRoomAdjRow('mat', idx, r.materialAdjPct !== undefined ? r.materialAdjPct : (r.adjustment || 0), 'Base cabinets', 'e.g. bathroom vanities run smaller than kitchen cabinets, or commercial jobs may always be pilaster cabinets')}
            ${mqRoomAdjRow('upper-mat', idx, r.upperMaterialAdjPct || 0, 'Upper cabinets', 'e.g. commercial jobs may always use a specific upper cabinet style')}
            ${mqRoomAdjRow('install', idx, r.installAdjPct || 0, 'Installation', 'e.g. renovations run higher since customers are living in the house')}
            ${mqRoomAdjRow('total', idx, r.totalAdjPct || 0, 'Total ballpark', 'e.g. a "Luxury package" tier priced a flat % above standard')}
          </div>
          <textarea id="mq-room-desc-${idx}" placeholder="Optional note shown to customers when they pick this project type — e.g. &quot;For door refacing, skip the box materials below — just add your square footage under Specialty Items instead.&quot;" rows="2" style="width:100%;font-size:12px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;resize:vertical;margin-bottom:8px">${(r.description||'').replace(/</g,'&lt;')}</textarea>
          <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px">
            <div id="mq-room-cover-preview-${idx}" style="width:56px;height:56px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
              ${r.coverImage ? `<img src="${r.coverImage}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>` : '<span style="font-size:20px">🖼️</span>'}
            </div>
            <div style="flex:1;min-width:0">
              <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Cover image (optional) — shows inside the note customers see when they pick this project type</label>
              <input type="text" id="mq-room-cover-${idx}" value="${(r.coverImage||'').replace(/"/g,'&quot;')}" placeholder="https://your-site.com/photo.jpg" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:4px"/>
              <label class="mq-btn mq-btn-sm" style="font-size:11px;cursor:pointer;display:inline-block">
                📤 Upload
                <input type="file" id="mq-room-cover-file-${idx}" accept="image/*" style="display:none"/>
              </label>
              <span id="mq-room-cover-status-${idx}" style="font-size:11px;margin-left:6px"></span>
            </div>
          </div>
          <div style="border-top:1px dashed #e5e7eb;padding-top:10px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">📏 How to measure your space (this project type)</label>
            <textarea id="mq-room-measure-text-${idx}" placeholder="Leave blank to use the standard measuring guide. Fill in to show your own instructions for this project type instead — e.g. how to measure for refacing vs. a full kitchen." rows="3" style="width:100%;font-size:12px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;resize:vertical;margin-bottom:6px">${(r.measureText||'').replace(/</g,'&lt;')}</textarea>
            <div style="margin-bottom:8px">
              <button type="button" class="mq-btn mq-btn-sm" style="font-size:11px" onclick="mqFillDefaultGuide('mq-room-measure-text-${idx}','${r.id}')">↺ Use default guide</button>
              <span style="font-size:11px;color:#9ca3af;margin-left:6px">Tip: **text** shows as bold, [calc] shows the calculator icon, [corner-img] shows the corner-cabinets photo, [tip]text[/tip] wraps it in a yellow callout box</span>
            </div>
            <div style="display:flex;gap:8px;align-items:flex-start">
              <div id="mq-room-measure-img-preview-${idx}" style="width:56px;height:56px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
                ${r.measureImage ? `<img src="${r.measureImage}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>` : '<span style="font-size:20px">📏</span>'}
              </div>
              <div style="flex:1;min-width:0">
                <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Measuring guide image (optional)</label>
                <input type="text" id="mq-room-measure-img-${idx}" value="${(r.measureImage||'').replace(/"/g,'&quot;')}" placeholder="https://your-site.com/how-to-measure.jpg" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:4px"/>
                <label class="mq-btn mq-btn-sm" style="font-size:11px;cursor:pointer;display:inline-block">
                  📤 Upload
                  <input type="file" id="mq-room-measure-img-file-${idx}" accept="image/*" style="display:none"/>
                </label>
                <span id="mq-room-measure-img-status-${idx}" style="font-size:11px;margin-left:6px"></span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Wire each room's cover-image upload button — uploads immediately, fills
    // the URL field, and refreshes the small preview thumbnail on success.
    rooms.forEach((r, idx) => {
      mqWireUploadButton(
        null,
        `mq-room-cover-file-${idx}`,
        `mq-room-cover-status-${idx}`,
        `mq-room-cover-${idx}`,
        window._mqShopRecord?.fields?.['Shop token'] || 'unknown-shop',
        'products',
        (url) => {
          const preview = document.getElementById(`mq-room-cover-preview-${idx}`);
          if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          mqSaveRooms();
        }
      );
      mqWireUploadButton(
        null,
        `mq-room-measure-img-file-${idx}`,
        `mq-room-measure-img-status-${idx}`,
        `mq-room-measure-img-${idx}`,
        window._mqShopRecord?.fields?.['Shop token'] || 'unknown-shop',
        'products',
        (url) => {
          const preview = document.getElementById(`mq-room-measure-img-preview-${idx}`);
          if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          mqSaveRooms();
        }
      );
    });

    // Drag-and-drop reordering — same pattern already used for Specialty
    // items, adapted since rooms live in one JSON list rather than separate
    // Airtable records, so reordering just means rebuilding that array.
    // draggable only turns on while the mouse is actually down on the ⠿
    // handle — leaving the whole row draggable all the time made selecting
    // text anywhere in it (like the measuring guide box) prone to being
    // mistaken for a row-drag instead of a text selection.
    let dragging = null;
    container.querySelectorAll('.mq-room-row').forEach(row => {
      row.draggable = false;
      const handle = row.querySelector('.mq-room-drag-handle');
      if (handle) handle.addEventListener('mousedown', () => { row.draggable = true; });
      row.addEventListener('mouseup', () => { row.draggable = false; });
      row.addEventListener('dragstart', () => {
        dragging = row;
        setTimeout(() => row.style.opacity = '0.4', 0);
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        row.draggable = false;
        dragging = null;
        const newRooms = [...container.querySelectorAll('.mq-room-row')].map(r => {
          const oldIdx = r.dataset.idx;
          return {
            id: (window._mqRooms[oldIdx] || {}).id || ('room_' + Date.now()),
            name: document.getElementById(`mq-room-name-${oldIdx}`)?.value || '',
            materialAdjPct: parseFloat(document.getElementById(`mq-room-adj-mat-${oldIdx}`)?.value) || 0,
            upperMaterialAdjPct: parseFloat(document.getElementById(`mq-room-adj-upper-mat-${oldIdx}`)?.value) || 0,
            installAdjPct: parseFloat(document.getElementById(`mq-room-adj-install-${oldIdx}`)?.value) || 0,
            totalAdjPct: parseFloat(document.getElementById(`mq-room-adj-total-${oldIdx}`)?.value) || 0,
            description: document.getElementById(`mq-room-desc-${oldIdx}`)?.value || '',
            active: document.getElementById(`mq-room-active-${oldIdx}`)?.checked !== false,
            proOnly: document.getElementById(`mq-room-proonly-${oldIdx}`)?.checked === true,
            hideMeasureGuide: document.getElementById(`mq-room-hidemeasure-${oldIdx}`)?.checked === true,
            coverImage: document.getElementById(`mq-room-cover-${oldIdx}`)?.value || '',
            measureText: document.getElementById(`mq-room-measure-text-${oldIdx}`)?.value || '',
            measureImage: document.getElementById(`mq-room-measure-img-${oldIdx}`)?.value || '',
          };
        });
        window._mqRooms = newRooms;
        renderRoomsList();
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const after = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        if (e.clientY < after) {
          container.insertBefore(dragging, row);
        } else {
          container.insertBefore(dragging, row.nextSibling);
        }
      });
    });

    mqRefreshRestoreDropdown();
  }

  // Keeps the "Restore a default type" dropdown showing only the standard
  // project types (Kitchen, Bathroom, Refacing, etc.) that are currently
  // missing from this shop's own list — so a shop owner who accidentally
  // deleted one can bring it straight back with its original description,
  // cover image, and measuring guide intact, without needing to recreate
  // any of that by hand.
  function mqRefreshRestoreDropdown() {
    const sel = document.getElementById('mq-restore-room-select');
    if (!sel) return;
    const currentIds = new Set((window._mqRooms || []).map(r => r.id));
    const missing = defaultRoomTypes().filter(r => !currentIds.has(r.id));
    sel.innerHTML = `<option value="">↩ Restore a default type…</option>` +
      missing.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    sel.style.display = missing.length ? 'inline-block' : 'none';
  }

  window.mqRestoreDefaultRoom = function(roomId) {
    if (!roomId) return;
    const defaults = defaultRoomTypes();
    const roomDef = defaults.find(r => r.id === roomId);
    if (!roomDef) return;
    if (!window._mqRooms) window._mqRooms = [];
    window._mqRooms.push({ ...roomDef });
    _mqExpandedRoomIds.add(roomId);
    renderRoomsList();
    showMsg('mq-rooms-msg', `✓ "${roomDef.name}" restored with its default description, image, and measuring guide.`);
  };

  window.mqAddRoom = function() {
    if (!window._mqRooms) window._mqRooms = [];
    const newId = 'room_' + Date.now();
    window._mqRooms.push({ id: newId, name: '', materialAdjPct: 0, upperMaterialAdjPct: 0, installAdjPct: 0, totalAdjPct: 0, description: '', active: true, proOnly: false, coverImage: '', measureText: '', measureImage: '' });
    _mqExpandedRoomIds.add(newId);
    renderRoomsList();
  };

  window.mqRemoveRoom = function(idx) {
    if (!window._mqRooms) return;
    window._mqRooms.splice(idx, 1);
    renderRoomsList();
  };

  window.mqSaveRooms = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      // Read current DOM values so any in-progress edits get captured, not
      // just whatever was there when the list was last rendered.
      const rooms = (window._mqRooms || []).map((r, idx) => ({
        id: r.id,
        name: (el(`mq-room-name-${idx}`)?.value || '').trim(),
        materialAdjPct: parseFloat(el(`mq-room-adj-mat-${idx}`)?.value) || 0,
        upperMaterialAdjPct: parseFloat(el(`mq-room-adj-upper-mat-${idx}`)?.value) || 0,
        installAdjPct: parseFloat(el(`mq-room-adj-install-${idx}`)?.value) || 0,
        totalAdjPct: parseFloat(el(`mq-room-adj-total-${idx}`)?.value) || 0,
        description: (el(`mq-room-desc-${idx}`)?.value || '').trim(),
        active: el(`mq-room-active-${idx}`)?.checked !== false,
        proOnly: el(`mq-room-proonly-${idx}`)?.checked === true,
        hideMeasureGuide: el(`mq-room-hidemeasure-${idx}`)?.checked === true,
        coverImage: (el(`mq-room-cover-${idx}`)?.value || '').trim(),
        measureText: (el(`mq-room-measure-text-${idx}`)?.value || '').trim(),
        measureImage: (el(`mq-room-measure-img-${idx}`)?.value || '').trim(),
      })).filter(r => r.name); // drop any left with a blank name

      if (!rooms.length) { showMsg('mq-rooms-msg', 'You need at least one project type.', 'error'); return; }

      window._mqRooms = rooms;
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Room types': JSON.stringify(rooms) });
      shopRec.fields['Room types'] = JSON.stringify(rooms);
      renderRoomsList();
      showMsg('mq-rooms-msg', '✓ Project types saved!');
    } catch(e) { showMsg('mq-rooms-msg', 'Error saving — please try again.', 'error'); }
  };

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

  // Sort state for the Leads table — persists across filter changes so
  // picking "Contacted" doesn't reset whatever sort the shop owner had set.
  let _mqLeadSort = { field: 'date', dir: 'desc' };

  function sortLeadsArray(leads) {
    const { field, dir } = _mqLeadSort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...leads].sort((a, b) => {
      let av, bv;
      switch (field) {
        case 'name':  av = (a.fields['Customer name']  || '').toLowerCase(); bv = (b.fields['Customer name']  || '').toLowerCase(); break;
        case 'email': av = (a.fields['Customer email'] || '').toLowerCase(); bv = (b.fields['Customer email'] || '').toLowerCase(); break;
        case 'phone': av = (a.fields['Customer phone'] || '');               bv = (b.fields['Customer phone'] || '');               break;
        case 'type':  av = (a.fields['Quote type'] || '').toLowerCase();     bv = (b.fields['Quote type'] || '').toLowerCase();     break;
        case 'room':  av = (a.fields['Room type'] || '').toLowerCase();      bv = (b.fields['Room type'] || '').toLowerCase();      break;
        case 'price': av = a.fields['Estimate low'] || 0;                    bv = b.fields['Estimate low'] || 0;                    break;
        case 'date':
        default:      av = new Date(a.createdTime).getTime();                bv = new Date(b.createdTime).getTime();                break;
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
  }

  window.mqSortLeads = function(field) {
    if (_mqLeadSort.field === field) {
      _mqLeadSort.dir = _mqLeadSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      _mqLeadSort.field = field;
      _mqLeadSort.dir = field === 'date' ? 'desc' : 'asc'; // newest-first for date, A-Z for everything else
    }
    mqFilterLeads();
  };

  function sortArrow(field) {
    if (_mqLeadSort.field !== field) return '';
    return _mqLeadSort.dir === 'asc' ? ' ▲' : ' ▼';
  }

  function formatLeadDate(createdTime) {
    if (!createdTime) return '—';
    const d = new Date(createdTime);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  }

  function renderLeads(leads, limit) {
    if (!leads.length) return '<div class="mq-empty">No leads yet — share your widget to start capturing quotes!</div>';

    // Group leads sharing a Session ID so multi-attempt visitors get a clear
    // label instead of a bare "N attempts" badge. If nobody in the session
    // ever gave a name, say so plainly; if someone did (even on a different
    // attempt within the same session), credit the other attempts to them
    // instead of leaving them looking like anonymous noise.
    const sessionGroups = {};
    leads.forEach(r => {
      const sid = r.fields['Session ID'];
      if (!sid) return;
      (sessionGroups[sid] = sessionGroups[sid] || []).push(r);
    });
    const sessionBadgeByLeadId = {};
    Object.values(sessionGroups).forEach(rows => {
      if (rows.length < 2) return; // no badge needed for a solo attempt
      // Order by when each estimate was actually made, so "1 of 2" / "2 of 2"
      // means something real, regardless of how the table itself is sorted.
      const chronological = [...rows].sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      const namedRow = chronological.find(r => (r.fields['Customer name'] || '').trim());
      if (namedRow) {
        const name = namedRow.fields['Customer name'].trim();
        // Shown on the OTHER rows, not the named row itself — no need to
        // tell someone "additional estimate by Jane Doe" directly under
        // Jane Doe's own already-labeled row.
        const others = chronological.filter(r => r !== namedRow);
        others.forEach((r, i) => {
          sessionBadgeByLeadId[r.id] = `🔗 Additional estimate ${i + 1} of ${others.length} by ${name}`;
        });
      } else {
        chronological.forEach((r, i) => {
          sessionBadgeByLeadId[r.id] = `🔗 Estimate ${i + 1} of ${chronological.length} by an unknown person`;
        });
      }
    });

    const rows = (limit ? leads.slice(0, limit) : leads).map(r => {
      const f = r.fields;
      const statusColors = { New: 'blue', Contacted: 'yellow', Booked: 'green', Lost: 'red' };
      const color = statusColors[f['Status']] || 'grey';
      const badgeText = sessionBadgeByLeadId[r.id];
      const sessionBadge = badgeText
        ? `<span title="Session ${f['Session ID']}" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:#6366f1;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:2px 7px;white-space:nowrap">${badgeText}</span>`
        : '';
      return `<tr>
        <td>${formatLeadDate(r.createdTime)}</td>
        <td><strong>${f['Customer name'] || '—'}</strong>${sessionBadge ? '<br>'+sessionBadge : ''}</td>
        <td>${f['Customer email'] || '—'}</td>
        <td>${f['Customer phone'] || '—'}</td>
        <td>${f['Quote type'] || '—'}</td>
        <td>${f['Room type'] || '—'}</td>
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
    const th = (field, label) => `<th onclick="mqSortLeads('${field}')" style="cursor:pointer;user-select:none;white-space:nowrap">${label}${sortArrow(field)}</th>`;
    return `<div class="mq-table-wrap"><table class="mq-table"><thead><tr>${th('date','Date')}${th('name','Name')}${th('email','Email')}${th('phone','Phone')}${th('type','Type')}${th('room','Project type')}${th('price','Estimate')}<th>Status</th><th>Update</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderStats(leads) {
    const total = leads.length;
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newThisWeek = leads.filter(r => new Date(r.fields['Created'] || r.createdTime) > oneWeekAgo).length;
    const booked = leads.filter(r => r.fields['Status'] === 'Booked').length;
    const pipeline = leads.reduce((sum, r) => sum + (r.fields['Estimate high'] || 0), 0);
    const withContact = leads.filter(r => r.fields['Customer email'] || r.fields['Customer phone']).length;
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
    set('mq-stat-leads', total);
    set('mq-stat-new', newThisWeek);
    set('mq-stat-booked', booked);
    set('mq-stat-value', fmt(pipeline));
    set('mq-stat-contacts', withContact);
  }

  // A real dropdown of every category already in use — one click to reuse
  // one, no retyping, plus a "+ Add new category" option for when a
  // genuinely new one is needed. Shared between the per-shop table and the
  // Templates cards; each just passes in whichever list of categories is
  // relevant to its own set of items.
  function mqCategoryPickerHTML(r, allCategories, wide) {
    const current = (r.fields['Category']||'').trim();
    const options = allCategories.map(c => `<option value="${c.replace(/"/g,'&quot;')}" ${c===current?'selected':''}>${c}</option>`).join('');
    return `<select id="mq-spec-cat-${r.id}" onchange="mqSpecCategoryChanged('${r.id}', this)" style="font-size:${wide?'11px':'12px'};padding:${wide?'5px 8px':'4px 6px'};border:1px solid ${wide?'#e5e7eb':'#d1d5db'};border-radius:${wide?'6px':'5px'};${wide?'width:100%':'max-width:130px'};color:#374151">
      <option value="" ${!current?'selected':''}>${wide?'No category':'(No category)'}</option>
      ${options}
      <option value="__new__">+ Add new category…</option>
    </select>`;
  }
  window.mqSpecCategoryChanged = function(id, sel) {
    const row = sel.closest('tr');
    if (sel.value === '__new__') {
      const name = (prompt('New category name:') || '').trim();
      if (name) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        opt.selected = true;
        sel.insertBefore(opt, sel.lastElementChild);
        mqSaveSpecField(id, 'Category', name);
        if (row) row.setAttribute('data-category', name);
        // Make the new category immediately pickable everywhere else on the
        // page too, without needing a reload — every other item's own
        // dropdown, plus the "Filter by category" dropdown.
        document.querySelectorAll('select[id^="mq-spec-cat-"]').forEach(otherSel => {
          if (otherSel === sel) return;
          if ([...otherSel.options].some(o => o.value === name)) return;
          const newOpt = document.createElement('option');
          newOpt.value = name;
          newOpt.textContent = name;
          otherSel.insertBefore(newOpt, otherSel.lastElementChild);
        });
        const filterSel = document.getElementById('mq-spec-tab-filter-category');
        if (filterSel && ![...filterSel.options].some(o => o.value === name)) {
          const filterOpt = document.createElement('option');
          filterOpt.value = name;
          filterOpt.textContent = name;
          filterSel.appendChild(filterOpt);
        }
      } else {
        sel.value = ''; // cancelled — back to no category
      }
    } else {
      mqSaveSpecField(id, 'Category', sel.value);
      if (row) row.setAttribute('data-category', sel.value);
    }
    // Whether it's a brand new category or a change to an existing one,
    // re-check this row against whatever filter is currently active — an
    // item moved out of the category being filtered on should disappear
    // right away, not linger until the page gets refreshed.
    if (typeof window.mqFilterSpecTable === 'function') window.mqFilterSpecTable();
  };

  function renderSpecialty(specs, shopRecord) {
    const container = el('mq-spec-list');
    if (!container) return;
    if (!specs.length) {
      container.innerHTML = '<div class="mq-empty" style="padding:2rem">No specialty items yet. Click "+ Add item" to add your first one.</div>';
      return;
    }
    const rooms = window._mqRooms || defaultRoomTypes();
    const roomOptions = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    container.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:#f9fafb;border-radius:8px">
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Filter by project type</label>
          <select id="mq-spec-tab-filter-room" onchange="mqFilterSpecTable()" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%">
            <option value="">All project types</option>
            ${roomOptions}
          </select>
        </div>
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Filter by category</label>
          <select id="mq-spec-tab-filter-category" onchange="mqFilterSpecTable()" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%">
            <option value="">All categories</option>
            ${[...new Set(specs.map(r => (r.fields['Category']||'').trim()).filter(Boolean))].map(c => `<option value="${c.replace(/"/g,'&quot;')}">${c}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Search by name</label>
          <input type="text" id="mq-spec-tab-filter-search" oninput="mqFilterSpecTable()" placeholder="e.g. lazy susan" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%"/>
        </div>
      </div>
      <div id="mq-spec-tab-filter-empty" style="display:none;font-size:13px;color:#9ca3af;padding:1rem;text-align:center">No specialty items match that filter.</div>
      <div class="mq-table-wrap" id="mq-spec-table-wrap">
      <table class="mq-table" id="mq-spec-table">
        <thead><tr><th></th><th>Item name</th><th>Category</th><th>Price</th><th>Per lin ft?</th><th>Per sq ft?</th><th>Offer supply/install choice?</th><th>Installed price / Mode</th><th>Project types</th><th>Pro only?</th><th>Active</th><th></th></tr></thead>
        <tbody id="mq-spec-tbody">
          ${specs.map(r => {
            let visibleRooms = [];
            try { visibleRooms = r.fields['Visible rooms'] ? JSON.parse(r.fields['Visible rooms']) : []; } catch(e) { visibleRooms = []; }
            const roomsAttr = (r.fields['Visible rooms'] || '[]').replace(/"/g,'&quot;');
            const nameAttr = (r.fields['Item name'] || '').toLowerCase().replace(/"/g,'&quot;');
            const catAttr = (r.fields['Category'] || '').replace(/"/g,'&quot;');
            return `
            <tr data-id="${r.id}" data-rooms="${roomsAttr}" data-name="${nameAttr}" data-category="${catAttr}" style="cursor:grab">
              <td class="mq-spec-drag-handle" style="color:#9ca3af;font-size:16px;padding:8px 12px;cursor:grab">⠿</td>
              <td>
                <div style="display:flex;flex-direction:column;gap:2px">
                  <textarea id="mq-spec-name-${r.id}" style="display:block;border:none;background:none;font-size:13px;width:180px;height:34px;resize:none;overflow-y:auto;font-family:inherit;padding:2px 0;line-height:1.3" onblur="mqSaveSpecField('${r.id}','Item name',this.value)">${(r.fields['Item name'] || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                  <textarea id="mq-spec-desc-${r.id}" placeholder="Optional short description" style="display:block;border:none;background:none;font-size:11px;color:#9ca3af;width:180px;height:30px;font-style:italic;resize:none;overflow-y:auto;font-family:inherit;padding:2px 0;line-height:1.3" onblur="mqSaveSpecField('${r.id}','Description',this.value)">${(r.fields['Description']||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                </div>
              </td>
              <td>${mqCategoryPickerHTML(r, [...new Set(specs.map(x => (x.fields['Category']||'').trim()).filter(Boolean))])}</td>
              <td><input type="number" value="${r.fields['Price'] || ''}" id="mq-spec-price-${r.id}" style="width:80px" onblur="mqSaveSpecField('${r.id}','Price',parseFloat(this.value))"/></td>
              <td><input type="checkbox" id="mq-spec-perft-${r.id}" ${r.fields['Per linear foot']?'checked':''} onchange="mqSaveSpecUnit('${r.id}','Per linear foot',this.checked)"/></td>
              <td><input type="checkbox" id="mq-spec-persqft-${r.id}" ${r.fields['Per square foot']?'checked':''} onchange="mqSaveSpecUnit('${r.id}','Per square foot',this.checked)"/></td>
              <td><input type="checkbox" id="mq-spec-offerchoice-${r.id}" ${r.fields['Offers install choice']?'checked':''} onchange="mqToggleSpecInstallChoice('${r.id}')" title="Let the customer pick supply only vs. supplied &amp; installed for this specific item"/></td>
              <td id="mq-spec-installcol-${r.id}">${mqSpecInstallColHTML(r)}</td>
              <td style="font-size:12px;color:#6b7280">${roomLinkDisclosure(r.id, r.fields['Visible rooms'])}</td>
              <td><input type="checkbox" ${r.fields['Pro only']?'checked':''} onchange="mqSaveSpecField('${r.id}','Pro only',this.checked)" title="Hide this item from the customer-facing widget entirely — still shows in MidasQuote Pro, for every project type it's tagged to"/></td>
              <td><input type="checkbox" ${r.fields['Active']?'checked':''} onchange="mqSaveSpecField('${r.id}','Active',this.checked)"/></td>
              <td><button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteSpec('${r.id}')">Delete</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;

    const tbody = document.getElementById('mq-spec-tbody');
    let dragging = null;

    // Same fix as Project Types rows: draggable only turns on while the
    // mouse is actually down on the ⠿ handle — leaving the whole row
    // draggable all the time made selecting text anywhere in it (like the
    // item name) prone to being grabbed as a row-drag instead of a normal
    // text selection.
    tbody.querySelectorAll('tr').forEach(row => {
      row.draggable = false;
      const handle = row.querySelector('.mq-spec-drag-handle');
      if (handle) handle.addEventListener('mousedown', () => { row.draggable = true; });
      row.addEventListener('mouseup', () => { row.draggable = false; });
      row.addEventListener('dragstart', () => {
        dragging = row;
        setTimeout(() => row.style.opacity = '0.4', 0);
      });
      row.addEventListener('dragend', async () => {
        row.style.opacity = '1';
        row.draggable = false;
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
  window.mqRefreshLogoPreview = function() {
    const urlInput = el('mq-shop-logo');
    const preview  = el('mq-shop-logo-preview');
    const img      = el('mq-shop-logo-img');
    if (!urlInput || !preview || !img) return;
    const url = urlInput.value.trim();
    if (url) {
      img.src = url;
      img.onerror = () => { preview.style.display = 'none'; };
      img.onload  = () => { preview.style.display = 'block'; };
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
      img.src = '';
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
        'Financing link':    gv('mq-financing-link'),
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
    trim_crown:   'crown',
    trim_valance: 'valance',
    tall_cabinet: 'tallcabinets',
  };

  const _photoCache = {};

  async function fetchPhotoFolder(cat) {
    const folder = CAT_TO_FOLDER[cat] || cat;
    if (_photoCache[folder]) return _photoCache[folder];
    try {
      const res = await fetch(`${GH_API}/${folder}`);
      if (!res.ok) { _photoCache[folder] = []; return []; }
      const files = await res.json();
      if (!Array.isArray(files)) { _photoCache[folder] = []; return []; }
      const photos = files
        .filter(f => f && f.name && /\.(jpg|jpeg|png|webp)$/i.test(f.name))
        .map(f => ({
          url:   `${GH_BASE}/${folder}/${f.name}`,
          label: (f.name || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
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
      <div style="background:#fff;border-radius:14px;width:100%;max-width:780px;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div style="font-size:15px;font-weight:600;color:#111">📷 Choose from library</div>
          <button onclick="mqClosePhotoPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1">×</button>
        </div>
        <div style="position:relative;display:flex;align-items:center">
          <button onclick="document.getElementById('mq-picker-grid').scrollBy({left:-400,behavior:'smooth'})"
            style="flex-shrink:0;width:36px;height:36px;margin-left:8px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:16px;color:#374151;box-shadow:0 2px 6px rgba(0,0,0,0.1)">‹</button>
          <div id="mq-picker-grid" style="padding:1rem;overflow-x:auto;overflow-y:hidden;flex:1;display:flex;gap:12px;scroll-behavior:smooth"></div>
          <button onclick="document.getElementById('mq-picker-grid').scrollBy({left:400,behavior:'smooth'})"
            style="flex-shrink:0;width:36px;height:36px;margin-right:8px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:16px;color:#374151;box-shadow:0 2px 6px rgba(0,0,0,0.1)">›</button>
        </div>
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

    const escapeHtmlLib = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    grid.innerHTML = photos.map((p, i) => `
      <div data-photo-idx="${i}" title="${escapeHtmlLib(p.label)}"
        style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;transition:all 0.15s;display:flex;flex-direction:column;width:170px;flex:0 0 170px">
        <img src="${p.url}" style="width:100%;height:100px;object-fit:cover;display:block;flex-shrink:0"
          onerror="this.parentElement.style.display='none'"/>
        <div style="padding:6px 8px;font-size:11px;font-weight:500;color:#374151;text-align:center;line-height:1.35;word-break:break-word;min-height:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center">${escapeHtmlLib(p.label)}</div>
      </div>`).join('');

    // Hover effect + safe click binding — avoids breakage from special characters in filenames
    grid.querySelectorAll('[data-photo-idx]').forEach(card => {
      const idx = parseInt(card.dataset.photoIdx, 10);
      card.onclick = () => mqSelectLibraryPhoto(photos[idx].url);
      card.onmouseover = () => { card.style.borderColor = '#1a1a1a'; };
      card.onmouseout = () => { card.style.borderColor = '#e5e7eb'; };
    });
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

  // Same pure view filter, for the Specialty Items tab's table specifically.
  window.mqFilterSpecTable = function() {
    const roomFilter = el('mq-spec-tab-filter-room')?.value || '';
    const categoryFilter = el('mq-spec-tab-filter-category')?.value || '';
    const searchFilter = (el('mq-spec-tab-filter-search')?.value || '').toLowerCase().trim();
    const tbody = document.getElementById('mq-spec-tbody');
    if (!tbody) return;
    let visibleCount = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      let rooms = [];
      try { rooms = JSON.parse(row.getAttribute('data-rooms') || '[]'); } catch(e) { rooms = []; }
      const roomMatch = !roomFilter || !rooms.length || rooms.includes(roomFilter);
      const category = row.getAttribute('data-category') || '';
      const categoryMatch = !categoryFilter || category === categoryFilter;
      const name = row.getAttribute('data-name') || '';
      const searchMatch = !searchFilter || name.includes(searchFilter);
      const show = roomMatch && categoryMatch && searchMatch;
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    const emptyMsg = document.getElementById('mq-spec-tab-filter-empty');
    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  // Pure view filter — doesn't touch any saved data, just shows/hides cards
  // already on screen, so a long specialty items list stays manageable.
  window.mqFilterSpecialtyCards = function() {
    const roomFilter = el('mq-spec-filter-room')?.value || '';
    const searchFilter = (el('mq-spec-filter-search')?.value || '').toLowerCase().trim();
    const grid = document.getElementById('mq-spec-cards-grid');
    if (!grid) return;
    let visibleCount = 0;
    grid.querySelectorAll('.mq-spec-card-wrap').forEach(wrap => {
      let rooms = [];
      try { rooms = JSON.parse(wrap.getAttribute('data-rooms') || '[]'); } catch(e) { rooms = []; }
      const roomMatch = !roomFilter || !rooms.length || rooms.includes(roomFilter);
      const name = wrap.getAttribute('data-name') || '';
      const searchMatch = !searchFilter || name.includes(searchFilter);
      const show = roomMatch && searchMatch;
      wrap.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    const emptyMsg = document.getElementById('mq-spec-filter-empty');
    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  // Same pure view filter, for the Templates admin page.
  window.mqFilterTemplateCards = function() {
    const roomFilter = el('mq-tmpl-filter-room')?.value || '';
    const searchFilter = (el('mq-tmpl-filter-search')?.value || '').toLowerCase().trim();
    const grid = document.getElementById('mq-tmpl-cards-grid');
    if (!grid) return;
    let visibleCount = 0;
    grid.querySelectorAll('.mq-tmpl-card-wrap').forEach(wrap => {
      let rooms = [];
      try { rooms = JSON.parse(wrap.getAttribute('data-rooms') || '[]'); } catch(e) { rooms = []; }
      const roomMatch = !roomFilter || !rooms.length || rooms.includes(roomFilter);
      const name = wrap.getAttribute('data-name') || '';
      const searchMatch = !searchFilter || name.includes(searchFilter);
      const show = roomMatch && searchMatch;
      wrap.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    const emptyMsg = document.getElementById('mq-tmpl-filter-empty');
    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  window.mqSaveProducts = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    // Scoped to this tab's own container specifically — otherwise, if the
    // Templates admin tab has also been visited this session, its leftover
    // inputs (same id pattern) could get swept up into the wrong shop's save.
    const scope = document.getElementById('mq-products-content') || document;
    const photos = {};
    const hidden = {};
    scope.querySelectorAll('[id^="mq-photo-"]').forEach(input => {
      if (input.tagName !== 'INPUT') return;
      const key = input.id.replace('mq-photo-', '');
      if (input.value.trim()) photos[key] = input.value.trim();
    });
    scope.querySelectorAll('[id^="mq-hidden-"]').forEach(cb => {
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
      scope.querySelectorAll('.mq-products-save-btn').forEach(btn => {
        btn.textContent = 'Saved ✓';
        btn.style.background = '#1a1a1a';
        btn.style.borderColor = '#1a1a1a';
        setTimeout(() => { btn.textContent = 'Save changes'; }, 2000);
      });
      showMsg('mq-products-msg', '✓ Photos saved!');
    } catch(e) { showMsg('mq-products-msg', 'Error saving — please try again.', 'error'); }
  };

  // Same pattern as mqSaveProducts, but scoped to the Templates tab and
  // saving to the master template shop record instead of the admin's own shop.
  window.mqSaveTemplatePhotos = async function() {
    const masterShop = window._mqMasterTemplateShop;
    if (!masterShop) return;
    const scope = document.getElementById('mq-templates-content') || document;
    const photos = {};
    const hidden = {};
    scope.querySelectorAll('[id^="mq-photo-"]').forEach(input => {
      if (input.tagName !== 'INPUT') return;
      const key = input.id.replace('mq-photo-', '');
      if (input.value.trim()) photos[key] = input.value.trim();
    });
    scope.querySelectorAll('[id^="mq-hidden-"]').forEach(cb => {
      const key = cb.id.replace('mq-hidden-', '');
      if (cb.checked) hidden[key] = true;
    });
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, masterShop.id, {
        'Photos': JSON.stringify(photos),
        'Hidden': JSON.stringify(hidden),
      });
      masterShop.fields['Photos'] = JSON.stringify(photos);
      masterShop.fields['Hidden'] = JSON.stringify(hidden);
      scope.querySelectorAll('.mq-products-save-btn').forEach(btn => {
        btn.textContent = 'Saved ✓';
        btn.style.background = '#1a1a1a';
        btn.style.borderColor = '#1a1a1a';
        setTimeout(() => { btn.textContent = 'Save changes'; }, 2000);
      });
      showMsg('mq-templates-msg', '✓ Template photos saved!');
    } catch(e) { showMsg('mq-templates-msg', 'Error saving — please try again.', 'error'); }
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
      let cat = r.fields['Category'];
      if (!cat || EXCLUDED_CATS.has(cat.toLowerCase())) return;
      // Split trim into separate crown / valance buckets so they show as distinct sections
      if (cat === 'trim') {
        cat = (r.fields['Trim type'] === 'valance') ? 'trim_valance' : 'trim_crown';
      }
      if (!byCategory[cat]) byCategory[cat] = [];
      // Deduplicate by base name (strip "— uppers"/"— bases" suffix)
      const ITEM_EXCLUDE = /backsplash|cutout|cooktop/i;
      const baseName = (r.fields['Name'] || '').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i,'').trim();
      if (ITEM_EXCLUDE.test(baseName)) return;
      // Materials and drawers span 2 underlying records each (uppers/bases,
      // some/mostly) merged into one card — track every id so room-visibility
      // changes get applied to all of them together, keeping them in sync.
      let existing = byCategory[cat].find(x => x.baseName === baseName);
      if (!existing) {
        existing = { id: r.id, ids: [r.id], baseName, fullName: r.fields['Name'] || baseName, visibleRooms: r.fields['Visible rooms'] };
        byCategory[cat].push(existing);
      } else {
        existing.ids.push(r.id);
        if (!existing.visibleRooms && r.fields['Visible rooms']) existing.visibleRooms = r.fields['Visible rooms'];
      }
    });

    const CAT_DISPLAY = {
      material: { title:'🪵 Box Materials',       emoji:'🪵' },
      door:     { title:'🚪 Door Styles',          emoji:'🚪' },
      drawer:   { title:'🗄️ Drawer Configurations', emoji:'🗄️' },
      hinge:    { title:'🔧 Door Hinges',          emoji:'🔧' },
      countertop:{ title:'🪨 Countertop Materials', emoji:'🪨' },
      trim_crown:   { title:'👑 Crown Moulding',   emoji:'👑' },
      trim_valance: { title:'📏 Valance',          emoji:'📏' },
      tall_cabinet: { title:'🏛️ Tall Cabinets',    emoji:'🏛️' },
    };
    // Stored globally so mqToggleCategoryRoom (defined outside this closure)
    // can bulk-sync every item in a category when its category-level
    // checkbox changes.
    window._mqByCategory = byCategory;

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
    // Stored globally in the same {id, ids, visibleRooms} shape as byCategory
    // items, so the bulk-sync logic can treat specialty items identically.
    window._mqSpecItemsList = specItems.map(r => ({ id: r.id, ids: [r.id], visibleRooms: r.fields['Visible rooms'] }));

    const icons = {'tall':'📦','appliance':'🔌','blind':'↩️','garbage':'🗑️','toe':'👟','lazy':'🔄','wine':'🍷','spice':'🧂','pull':'📥','pot':'🍳','pantry':'🥫','desk':'🖥️','glass':'🪟','light':'💡','crown':'👑'};
    function specIcon(name) { for (const [k,v] of Object.entries(icons)) { if ((name||'').toLowerCase().includes(k)) return v; } return '⭐'; }

    let savedHidden = {};
    try { if (shopRecord.fields['Hidden']) savedHidden = JSON.parse(shopRecord.fields['Hidden']); } catch(e) {}

    function photoCard(key, name, emoji, cat, ids, visibleRoomsJson) {
      return photoCardShared(key, name, emoji, cat, ids, visibleRoomsJson, savedPhotos, savedHidden);
    }

    function catSection(cat) {
      const items = byCategory[cat] || [];
      if (!items.length) return '';
      const disp = CAT_DISPLAY[cat] || { title: cat, emoji: '📦' };
      const cards = items.map(item => {
        const key = `li_${cat}_${item.baseName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`;
        const lib = PHOTO_LIBRARY[item.baseName.toLowerCase().replace(/\s+/g,'_')] || {};
        return photoCard(key, item.baseName, lib.emoji || disp.emoji, cat, item.ids, item.visibleRooms);
      }).join('');
      return `<div class="mq-card" style="padding:0;overflow:hidden">
        <div onclick="mqToggleProductCategory('${cat}')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
          <div class="mq-card-title" style="margin:0">${disp.title} <span style="font-size:12px;font-weight:400;color:#9ca3af">(${items.length})</span></div>
          <span id="mq-cat-arrow-${cat}" style="display:inline-block;transition:transform 0.2s;font-size:13px;color:#9ca3af">▶</span>
        </div>
        <div id="mq-cat-body-${cat}" style="display:none;padding:0 1.25rem 1.25rem">
          <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add a photo URL for each item — leave blank to show the default icon on your showroom page.</p>
          ${categoryRoomDisclosure(cat)}
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">${cards}</div>
        </div>
      </div>`;
    }
    // Starts every category closed by default — with a lot of items across
    // several categories, having them all open at once made this tab feel
    // overwhelming. Click any category's header to open or close just that
    // one.
    window.mqToggleProductCategory = function(cat) {
      const body = document.getElementById(`mq-cat-body-${cat}`);
      const arrow = document.getElementById(`mq-cat-arrow-${cat}`);
      if (!body) return;
      const opening = body.style.display === 'none';
      body.style.display = opening ? 'block' : 'none';
      if (arrow) arrow.style.transform = opening ? 'rotate(90deg)' : 'rotate(0deg)';
    };

    const specRoomOptions = (window._mqRooms || defaultRoomTypes()).map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    const specSection = specItems.length ? `<div class="mq-card" style="padding:0;overflow:hidden">
      <div onclick="mqToggleProductCategory('specialty')" style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem;cursor:pointer">
        <div class="mq-card-title" style="margin:0">⭐ Specialty Items <span style="font-size:12px;font-weight:400;color:#9ca3af">(${specItems.length})</span></div>
        <span id="mq-cat-arrow-specialty" style="display:inline-block;transition:transform 0.2s;font-size:13px;color:#9ca3af">▶</span>
      </div>
      <div id="mq-cat-body-specialty" style="display:none;padding:0 1.25rem 1.25rem">
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add photos to your specialty items. All active items from your Specialty Items tab appear here.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;padding:10px 12px;background:#f9fafb;border-radius:8px">
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Filter by project type</label>
          <select id="mq-spec-filter-room" onchange="mqFilterSpecialtyCards()" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%">
            <option value="">All project types</option>
            ${specRoomOptions}
          </select>
        </div>
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Search by name</label>
          <input type="text" id="mq-spec-filter-search" oninput="mqFilterSpecialtyCards()" placeholder="e.g. lazy susan" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%"/>
        </div>
      </div>
      <div id="mq-spec-filter-empty" style="display:none;font-size:13px;color:#9ca3af;padding:1rem;text-align:center">No specialty items match that filter.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px" id="mq-spec-cards-grid">
        ${specItems.map(r => {
          const itemName = r.fields['Item name'] || '';
          const roomsAttr = (r.fields['Visible rooms'] || '[]').replace(/"/g,'&quot;');
          return `<div class="mq-spec-card-wrap" data-rooms="${roomsAttr}" data-name="${itemName.toLowerCase().replace(/"/g,'&quot;')}">
            ${photoCard('spec_' + r.id, itemName, specIcon(itemName), 'specialty', [r.id], r.fields['Visible rooms'])}
          </div>`;
        }).join('')}
      </div>
      </div>
    </div>` : '';

    const content = el('mq-products-content');
    if (content) {
      const catsOrdered = ['material','door','drawer','hinge','countertop','trim_crown','trim_valance','tall_cabinet'];
      const hasCats = catsOrdered.some(c => byCategory[c]?.length);
      content.innerHTML = (!hasCats && !specItems.length)
        ? '<div class="mq-empty">Set up your pricing first — your configured items will appear here automatically.</div>'
        : catsOrdered.map(catSection).join('') + specSection;

      // Wire up upload buttons for every photo card just rendered
      const shopToken = shopRecord.fields['Shop token'] || 'unknown-shop';
      content.querySelectorAll('input[type="file"][id^="mq-upload-file-"]').forEach(fileInput => {
        const key = fileInput.id.replace('mq-upload-file-', '');
        mqWireUploadButton(
          null,
          'mq-upload-file-' + key,
          'mq-upload-status-' + key,
          'mq-photo-' + key,
          shopToken,
          'products',
          (url) => { mqPreviewPhoto(key); mqMarkProductsDirty(); }
        );
      });
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
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Show showroom': !isOn ? 'Show' : 'Hide' });
      shopRec.fields['Show showroom'] = !isOn ? 'Show' : 'Hide';
      showMsg('mq-products-msg', !isOn ? '✓ Showroom link enabled on widget.' : '✓ Showroom link hidden from widget.');
    } catch(e) { toggle.classList.toggle('on', isOn); showMsg('mq-products-msg', 'Error saving.', 'error'); }
  };

  window.mqToggleFinancing = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const toggle = el('mq-financing-toggle');
    if (!toggle) return;
    const isOn = toggle.classList.contains('on');
    toggle.classList.toggle('on', !isOn);
    const linkWrap = el('mq-financing-link-wrap');
    if (linkWrap) linkWrap.style.display = !isOn ? 'block' : 'none';
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Offers financing': !isOn ? 'Yes' : 'No' });
      shopRec.fields['Offers financing'] = !isOn ? 'Yes' : 'No';
      showMsg('mq-shop-msg', !isOn ? '✓ Financing note will show on your widget.' : '✓ Financing note hidden from widget.');
    } catch(e) { toggle.classList.toggle('on', isOn); if (linkWrap) linkWrap.style.display = isOn ? 'block' : 'none'; showMsg('mq-shop-msg', 'Error saving.', 'error'); }
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
      const updates = { [field]: value };
      // 'Special Items' is the primary field shown in Airtable's own view —
      // keep it in sync whenever the name changes, or it's left showing a
      // stale label (like "New template item") forever after a rename.
      if (field === 'Item name') updates['Special Items'] = value;
      await atUpdate(CONFIG.SPECIALTY_TABLE, id, updates);
    } catch(e) { console.error('Failed to save specialty field', e); }
  };

  // Per lin ft and Per sq ft are mutually exclusive — checking one unchecks
  // the other, both in the UI and in what gets saved, so an item never ends
  // up with both pricing units on at once.
  window.mqSaveSpecUnit = async function(id, field, checked) {
    const otherField = field === 'Per linear foot' ? 'Per square foot' : 'Per linear foot';
    const otherId = field === 'Per linear foot' ? `mq-spec-persqft-${id}` : `mq-spec-perft-${id}`;
    try {
      const updates = { [field]: checked };
      if (checked) {
        updates[otherField] = false;
        const otherCheckbox = document.getElementById(otherId);
        if (otherCheckbox) otherCheckbox.checked = false;
      }
      await atUpdate(CONFIG.SPECIALTY_TABLE, id, updates);
    } catch(e) { console.error('Failed to save specialty unit field', e); }
  };

  // Builds whichever content belongs in the "Installed price / Mode" column
  // for a given specialty item — an editable installed price if the shop
  // is offering the customer a choice, or a plain "which mode is this
  // item's one flat price" label if not.
  function mqSpecInstallColHTML(r) {
    const offersChoice = !!r.fields['Offers install choice'];
    if (offersChoice) {
      return `<div style="font-size:11px;color:#6b7280;margin-bottom:3px">Installed price:</div>
        <input type="number" value="${r.fields['Install price'] || ''}" id="mq-spec-installprice-${r.id}" placeholder="$0.00" style="width:100px" onblur="mqSaveSpecField('${r.id}','Install price',parseFloat(this.value))"/>`;
    }
    const mode = r.fields['Install mode'] || 'supply';
    return `<div style="font-size:11px;color:#6b7280;margin-bottom:3px">This item is priced as:</div>
      <select id="mq-spec-mode-${r.id}" onchange="mqSaveSpecField('${r.id}','Install mode',this.value)" style="font-size:12px;padding:5px 8px;border:1px solid #d1d5db;border-radius:4px;width:170px">
      <option value="supply" ${mode!=='installed'&&mode!=='na'?'selected':''}>Supply only</option>
      <option value="installed" ${mode==='installed'?'selected':''}>Supplied &amp; Installed</option>
      <option value="na" ${mode==='na'?'selected':''}>N/A — show no label</option>
    </select>`;
  }

  // Flips whether this item offers the customer a supply/install choice,
  // and swaps that column between an installed-price input and a plain
  // mode label accordingly. Reads whatever's currently in the DOM rather
  // than a fresh fetch, so a shop owner flipping this back and forth
  // doesn't lose whatever they'd already typed.
  window.mqToggleSpecInstallChoice = async function(id) {
    const chk = el(`mq-spec-offerchoice-${id}`);
    const col = el(`mq-spec-installcol-${id}`);
    if (!chk || !col) return;
    const offersChoice = chk.checked;
    try { await atUpdate(CONFIG.SPECIALTY_TABLE, id, { 'Offers install choice': offersChoice }); } catch(e) { console.error('Failed to save install choice toggle', e); }
    const existingPriceInput = document.getElementById(`mq-spec-installprice-${id}`);
    const existingModeSelect = document.getElementById(`mq-spec-mode-${id}`);
    col.innerHTML = mqSpecInstallColHTML({ id, fields: {
      'Offers install choice': offersChoice,
      'Install price': existingPriceInput ? existingPriceInput.value : '',
      'Install mode': existingModeSelect ? existingModeSelect.value : 'supply',
    }});
  };


  // Reads whatever room checkboxes are currently checked for this item,
  // and saves the list. If every configured room is checked, saves an empty
  // list instead — meaning "visible everywhere," which also automatically
  // includes any room added later, rather than needing to be re-checked.
  // Flips the room checkbox panel to open upward instead of downward when
  // there isn't enough room below in the viewport — same fix pattern used
  // for the widget's photo hover preview, which had the identical problem.
  window.mqPositionRoomPanel = function(detailsEl) {
    // Clean up any previous outside-click listener first, regardless of
    // whether we're opening or closing, to avoid stacking duplicates.
    if (detailsEl._mqCloseHandler) {
      document.removeEventListener('click', detailsEl._mqCloseHandler);
      detailsEl._mqCloseHandler = null;
    }
    if (!detailsEl.open) return;

    const panel = detailsEl.querySelector('.mq-room-panel');
    if (!panel) return;
    const summary = detailsEl.querySelector('summary') || detailsEl;
    const anchorRect = summary.getBoundingClientRect();

    // position:fixed, placed via the anchor's actual on-screen position —
    // not position:absolute — so this can never get invisibly clipped by a
    // scrolling ancestor (like the specialty items table's horizontal
    // scroll wrapper). Recomputed fresh every time it opens.
    panel.style.position = 'fixed';
    panel.style.left = Math.round(anchorRect.left) + 'px';
    panel.style.top = Math.round(anchorRect.bottom + 6) + 'px';
    panel.style.bottom = 'auto';
    panel.style.margin = '0';

    const panelRect = panel.getBoundingClientRect();
    if (panelRect.bottom > window.innerHeight) {
      panel.style.top = 'auto';
      panel.style.bottom = Math.round(window.innerHeight - anchorRect.top + 6) + 'px';
    }
    if (panelRect.right > window.innerWidth) {
      panel.style.left = Math.round(window.innerWidth - panelRect.width - 10) + 'px';
    }

    // Close on any click outside this details element. Deferred by one tick
    // so the same click that opened it doesn't immediately close it again.
    const closeHandler = (e) => {
      if (!detailsEl.contains(e.target)) {
        detailsEl.open = false;
        document.removeEventListener('click', closeHandler);
        detailsEl._mqCloseHandler = null;
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    detailsEl._mqCloseHandler = closeHandler;
  };

  window.mqToggleSpecRoom = async function(itemId) {
    const rooms = window._mqRooms || defaultRoomTypes();
    const checkedIds = rooms
      .filter(r => document.getElementById(`mq-spec-room-${itemId}-${r.id}`)?.checked)
      .map(r => r.id);
    const allChecked = checkedIds.length === rooms.length;
    const toSave = allChecked ? [] : checkedIds;
    try {
      await atUpdate(CONFIG.SPECIALTY_TABLE, itemId, { 'Visible rooms': JSON.stringify(toSave) });
      const summaryEl = document.getElementById(`mq-spec-room-summary-${itemId}`);
      if (summaryEl) summaryEl.textContent = roomLinkSummaryText(toSave, rooms);
      // Keep the row's own filterable data in sync and immediately re-apply
      // whatever filter is currently active — an item that no longer
      // matches the project type being filtered on should disappear right
      // away, not linger until the page gets refreshed.
      const row = document.querySelector(`#mq-spec-tbody tr[data-id="${itemId}"]`);
      if (row) row.setAttribute('data-rooms', JSON.stringify(toSave));
      if (typeof window.mqFilterSpecTable === 'function') window.mqFilterSpecTable();
    } catch(e) { console.error('Failed to save room links', e); }
  };

  function roomLinkSummaryText(visibleRooms, rooms) {
    if (!visibleRooms || !visibleRooms.length) return 'All project types';
    const names = visibleRooms.map(id => rooms.find(r => r.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'All project types';
  }

  function roomLinkDisclosure(itemId, visibleRoomsJson) {
    const rooms = window._mqRooms || defaultRoomTypes();
    let visibleRooms = [];
    try { visibleRooms = visibleRoomsJson ? JSON.parse(visibleRoomsJson) : []; } catch(e) { visibleRooms = []; }
    const summary = roomLinkSummaryText(visibleRooms, rooms);
    const checkboxes = rooms.map(r => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;cursor:pointer">
        <input type="checkbox" id="mq-spec-room-${itemId}-${r.id}" ${(!visibleRooms.length || visibleRooms.includes(r.id))?'checked':''} onchange="mqToggleSpecRoom('${itemId}')" style="width:auto"/> ${r.name}
      </label>`).join('');
    return `
      <details style="position:relative" ontoggle="mqPositionRoomPanel(this)">
        <summary style="font-size:12px;color:#1d4ed8;cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:#eff6ff;border-radius:6px;width:fit-content">
          <span id="mq-spec-room-summary-${itemId}">${summary}</span>
          <span style="font-size:15px;line-height:1">▾</span>
        </summary>
        <div class="mq-room-panel" style="position:fixed;z-index:10;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px">
          ${checkboxes}
        </div>
      </details>`;
  }

  // Same pattern as roomLinkDisclosure, but for My Products items — these
  // can span 2 underlying Airtable records per card (materials: uppers/bases;
  // drawers: some/mostly), so this saves to every id in that item's group at
  // once, keeping them consistent.
  // Module-level so both initProductsTab (My Products) and renderTemplates
  // (admin Templates tab) can share it, instead of it being locked inside one
  // function's closure over a specific shop's savedPhotos/savedHidden.
  function photoCardShared(key, name, emoji, cat, ids, visibleRoomsJson, savedPhotos, savedHidden) {
    const savedUrl = savedPhotos[key] || '';
    const isHidden = savedHidden[key] || false;
    const preview = savedUrl
      ? `<img src="${savedUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:100%;height:120px;background:#f0efeb;border-radius:8px;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`
      : `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`;
    const roomLinkHtml = ids ? `<div style="margin-bottom:8px">${lineItemRoomDisclosure(key, visibleRoomsJson, ids, cat)}</div>` : '';
    return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;${isHidden ? 'opacity:0.5' : ''}">
      <div id="mq-photo-preview-${key}">${preview}</div>
      <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${name}</div>
      ${roomLinkHtml}
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;margin-bottom:8px;cursor:pointer">
        <input type="checkbox" id="mq-hidden-${key}" ${isHidden ? 'checked' : ''} style="width:auto"
          onchange="mqMarkProductsDirty();this.closest('div[style*=border-radius]').style.opacity=this.checked?'0.5':'1'"/>
        Hide from showroom
      </label>
      <label class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:6px;text-align:center;cursor:pointer;display:block;box-sizing:border-box">
        📤 Upload a photo
        <input type="file" id="mq-upload-file-${key}" accept="image/*" style="display:none"/>
      </label>
      <div id="mq-upload-status-${key}" style="font-size:11px;text-align:center;margin-bottom:6px;min-height:14px"></div>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Or paste a photo URL <span style="color:#dc2626;font-weight:600">— don't use Facebook links, they expire and will break!</span></div>
      <input type="text" id="mq-photo-${key}" value="${savedUrl}" placeholder="https://your-site.com/photo.jpg"
        style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"
        oninput="mqMarkProductsDirty()"/>
      <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:4px" onclick="mqPreviewPhoto('${key}')">Preview photo</button>
      <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;color:#6b7280" onclick="mqOpenPhotoPicker('${key}','${cat||'specialty'}')">📷 Choose from library</button>
    </div>`;
  }

  // Template cards need editable name/price/unit fields too (regular My
  // Products items get that from the separate Specialty Items tab table —
  // templates don't have an equivalent, so it lives right on the card here).
  function templateItemCard(r, savedPhotos, savedHidden, allItems) {
    const itemName = r.fields['Item name'] || '';
    const photoHtml = photoCardShared('spec_' + r.id, '', '⭐', 'specialty', [r.id], r.fields['Visible rooms'], savedPhotos, savedHidden);
    const categoryList = [...new Set((allItems||[]).map(x => (x.fields['Category']||'').trim()).filter(Boolean))];
    return `<div style="display:flex;flex-direction:column;gap:6px">
      <input type="text" value="${itemName.replace(/"/g,'&quot;')}" id="mq-spec-name-${r.id}" placeholder="Item name" style="font-size:13px;font-weight:600;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px" onblur="mqSaveSpecField('${r.id}','Item name',this.value)"/>
      ${mqCategoryPickerHTML(r, categoryList, true)}
      <input type="text" value="${(r.fields['Description']||'').replace(/"/g,'&quot;')}" id="mq-spec-desc-${r.id}" placeholder="Optional short description" style="font-size:11px;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;color:#6b7280" onblur="mqSaveSpecField('${r.id}','Description',this.value)"/>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input type="number" value="${r.fields['Price']||''}" id="mq-spec-price-${r.id}" placeholder="Price" style="font-size:12px;padding:5px 6px;border:1px solid #d1d5db;border-radius:6px;width:70px" onblur="mqSaveSpecField('${r.id}','Price',parseFloat(this.value))"/>
        <label style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" id="mq-spec-perft-${r.id}" ${r.fields['Per linear foot']?'checked':''} onchange="mqSaveSpecUnit('${r.id}','Per linear foot',this.checked)" style="width:auto"/> lin ft</label>
        <label style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" id="mq-spec-persqft-${r.id}" ${r.fields['Per square foot']?'checked':''} onchange="mqSaveSpecUnit('${r.id}','Per square foot',this.checked)" style="width:auto"/> sq ft</label>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <label style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" id="mq-spec-offerchoice-${r.id}" ${r.fields['Offers install choice']?'checked':''} onchange="mqToggleSpecInstallChoice('${r.id}')" style="width:auto"/> Offer supply/install choice</label>
        <label style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" ${r.fields['Pro only']?'checked':''} onchange="mqSaveSpecField('${r.id}','Pro only',this.checked)" style="width:auto"/> ⚡ Pro only</label>
      </div>
      <div id="mq-spec-installcol-${r.id}">${mqSpecInstallColHTML(r)}</div>
      ${photoHtml}
      <button class="mq-btn mq-btn-primary mq-btn-sm" style="width:100%;margin-bottom:4px" onclick="mqPushSingleTemplateItem('${r.id}')">📤 Push/refresh this item</button>
      <button class="mq-btn mq-btn-danger mq-btn-sm" style="width:100%" onclick="mqDeleteTemplateItem('${r.id}')">Delete template item</button>
    </div>`;
  }

  async function renderTemplates() {
    const masterShop = await ensureMasterTemplateShop();
    const items = await ensureMasterTemplateItems();
    window._mqTemplateItems = items;

    let savedPhotos = {};
    let savedHidden = {};
    try { if (masterShop.fields['Photos']) savedPhotos = JSON.parse(masterShop.fields['Photos']); } catch(e) {}
    try { if (masterShop.fields['Hidden']) savedHidden = JSON.parse(masterShop.fields['Hidden']); } catch(e) {}

    const content = document.getElementById('mq-templates-content');
    if (!content) return;
    if (!items.length) {
      content.innerHTML = '<div class="mq-empty">No template items yet. Click "+ Add template item" below to add your first one.</div>';
      return;
    }
    const rooms = window._mqRooms || defaultRoomTypes();
    const roomOptions = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    content.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:#f9fafb;border-radius:8px">
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Filter by project type</label>
          <select id="mq-tmpl-filter-room" onchange="mqFilterTemplateCards()" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%">
            <option value="">All project types</option>
            ${roomOptions}
          </select>
        </div>
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:4px">Search by name</label>
          <input type="text" id="mq-tmpl-filter-search" oninput="mqFilterTemplateCards()" placeholder="e.g. shaker door" style="font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%"/>
        </div>
      </div>
      <div id="mq-tmpl-filter-empty" style="display:none;font-size:13px;color:#9ca3af;padding:1rem;text-align:center">No template items match that filter.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px" id="mq-tmpl-cards-grid">
        ${items.map(r => {
          const itemName = r.fields['Item name'] || '';
          const roomsAttr = (r.fields['Visible rooms'] || '[]').replace(/"/g,'&quot;');
          return `<div class="mq-tmpl-card-wrap" data-rooms="${roomsAttr}" data-name="${itemName.toLowerCase().replace(/"/g,'&quot;')}">
            ${templateItemCard(r, savedPhotos, savedHidden, items)}
          </div>`;
        }).join('')}
      </div>
      
    `;

    // Wire up upload buttons for every template card just rendered — this
    // step was missing entirely before, so the file picker existed visually
    // but selecting a file did nothing at all.
    content.querySelectorAll('input[type="file"][id^="mq-upload-file-"]').forEach(fileInput => {
      const key = fileInput.id.replace('mq-upload-file-', '');
      mqWireUploadButton(
        null,
        'mq-upload-file-' + key,
        'mq-upload-status-' + key,
        'mq-photo-' + key,
        MASTER_TEMPLATE_SHOP_NAME,
        'products',
        (url) => { mqPreviewPhoto(key); mqMarkProductsDirty(); }
      );
    });
  }

  window.mqAddTemplateItem = async function() {
    try {
      const masterShop = await ensureMasterTemplateShop();
      const created = await atCreate(CONFIG.SPECIALTY_TABLE, {
        'Shop': [masterShop.id],
        'Item name': 'New template item',
        'Special Items': 'New template item',
        'Price': 0,
        'Active': true,
      });
      if (!created?.id) {
        console.error('Failed to create template item:', created);
        showMsg('mq-templates-msg', 'Error adding item — check the browser console for details.', 'error');
        return;
      }
      await renderTemplates();
      showMsg('mq-templates-msg', '✓ Template item added — edit the name, price, and project types above.');
    } catch(e) {
      console.error('Failed to create template item:', e);
      showMsg('mq-templates-msg', 'Error adding item.', 'error');
    }
  };

  window.mqDeleteTemplateItem = async function(id) {
    if (!confirm('Delete this template item? This only affects future shops — existing shops keep their own copy.')) return;
    try {
      await atDelete(CONFIG.SPECIALTY_TABLE, id);
      await renderTemplates();
      showMsg('mq-templates-msg', '✓ Template item deleted.');
    } catch(e) { showMsg('mq-templates-msg', 'Error deleting item.', 'error'); }
  };

  // Additive only, per your call: adds template items a shop doesn't already
  // have (matched by Template source ID, not name — so renaming a template
  // later never causes duplicates or misses). Never touches or removes
  // anything a shop already has, even if you've since edited the master copy.
  window.mqPushTemplatesToAllShops = async function() {
    if (!confirm('Push ALL template items to every shop? This fully replaces any matching item a shop already has — full sync, not additive. Name, price, units, tags, and photo will always exactly match the master.')) return;
    showMsg('mq-templates-msg', 'Pushing to all shops — this may take a moment...');
    try {
      const masterShop = await ensureMasterTemplateShop();
      let masterPhotos = {};
      try { masterPhotos = masterShop.fields['Photos'] ? JSON.parse(masterShop.fields['Photos']) : {}; } catch(e) {}

      const masterItems = await ensureMasterTemplateItems();
      const allShops = await atGet(CONFIG.SHOPS_TABLE, `{Shop name} != "${MASTER_TEMPLATE_SHOP_NAME}"`);
      const adminRooms = window._mqRooms || defaultRoomTypes();
      let createdCount = 0, replacedCount = 0, roomsAddedCount = 0, errorCount = 0;

      for (const shop of allShops) {
        const shopItems = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shop.fields['Shop name']}", ARRAYJOIN({Shop}))`);

        // Make sure every project type these items are tagged to actually
        // exists in this shop's room list — added as a draft (hidden) room
        // if it's missing, so it never silently shows up on their live
        // widget without them reviewing and switching it on themselves.
        let shopRooms = [];
        try { shopRooms = shop.fields['Room types'] ? JSON.parse(shop.fields['Room types']) : []; } catch(e) { shopRooms = []; }
        if (!Array.isArray(shopRooms) || !shopRooms.length) shopRooms = defaultRoomTypes();
        let shopRoomsChanged = false;
        masterItems.forEach(m => {
          let vr = [];
          try { vr = m.fields['Visible rooms'] ? JSON.parse(m.fields['Visible rooms']) : []; } catch(e) { vr = []; }
          vr.forEach(roomId => {
            if (!shopRooms.find(r => r.id === roomId)) {
              const adminRoomDef = adminRooms.find(r => r.id === roomId);
              shopRooms.push({ id: roomId, name: adminRoomDef ? adminRoomDef.name : roomId, materialAdjPct: 0, installAdjPct: 0, totalAdjPct: 0, description: adminRoomDef ? (adminRoomDef.description || '') : '', active: false, measureText: adminRoomDef ? (adminRoomDef.measureText || '') : '', measureImage: adminRoomDef ? (adminRoomDef.measureImage || '') : '' });
              shopRoomsChanged = true;
              roomsAddedCount++;
            }
          });
        });
        if (shopRoomsChanged) {
          await atUpdate(CONFIG.SHOPS_TABLE, shop.id, { 'Room types': JSON.stringify(shopRooms) });
          shop.fields['Room types'] = JSON.stringify(shopRooms);
        }

        let shopPhotos = {};
        try { shopPhotos = shop.fields['Photos'] ? JSON.parse(shop.fields['Photos']) : {}; } catch(e) {}

        // Sequential, not parallel — slower, but guarantees each item's
        // delete-then-recreate fully completes before moving to the next,
        // and makes any individual failure easy to isolate and log clearly.
        for (const master of masterItems) {
          try {
            // Match by tag first, but also fall back to an exact name match —
            // catches orphaned rows left behind by manual Airtable edits that
            // never got (or lost) their tracking tag, so they don't silently
            // block a clean push forever.
            const masterName = (master.fields['Item name'] || '').trim().toLowerCase();
            const existingMatches = shopItems.filter(i =>
              i.fields['Template source ID'] === master.id ||
              (i.fields['Item name'] || '').trim().toLowerCase() === masterName
            );
            if (existingMatches.length) {
              await Promise.all(existingMatches.map(item => atDelete(CONFIG.SPECIALTY_TABLE, item.id)));
              replacedCount++;
            } else {
              createdCount++;
            }
            const created = await atCreate(CONFIG.SPECIALTY_TABLE, {
              'Shop': [shop.id],
              'Item name': master.fields['Item name'],
              'Special Items': master.fields['Item name'],
              'Price': master.fields['Price'] || 0,
              'Per linear foot': master.fields['Per linear foot'] || false,
              'Per square foot': master.fields['Per square foot'] || false,
              'Offers install choice': master.fields['Offers install choice'] || false,
              'Install price': master.fields['Install price'] || 0,
              'Install mode': master.fields['Install mode'] || 'supply',
          'Description': master.fields['Description'] || '',
          'Category': master.fields['Category'] || '',
          'Pro only': master.fields['Pro only'] || false,
              'Active': false,
              'Visible rooms': master.fields['Visible rooms'] || '[]',
              'Template source ID': master.id,
            });
            if (!created?.id) {
              errorCount++;
              console.error('Failed to create pushed item:', master.fields['Item name'], 'for', shop.fields['Shop name'], created);
              continue;
            }
            // Write this item's photo immediately, right here — not batched
            // up to write once at the end of the shop's whole item loop.
            // Batching meant that if this slow, sequential push got
            // interrupted (browser throttling a backgrounded tab, closing
            // the page, anything) before every single item finished, the
            // photo write for that shop would never happen at all, even
            // though every item itself had already been created correctly.
            const masterPhotoUrl = masterPhotos['spec_' + master.id];
            if (masterPhotoUrl) {
              shopPhotos['spec_' + created.id] = masterPhotoUrl;
              await atUpdate(CONFIG.SHOPS_TABLE, shop.id, { 'Photos': JSON.stringify(shopPhotos) });
              shop.fields['Photos'] = JSON.stringify(shopPhotos);
            }
          } catch(e) {
            errorCount++;
            console.error('Failed to push item:', master.fields['Item name'], 'to', shop.fields['Shop name'], e);
          }
        }
      }
      const roomsNote = roomsAddedCount ? `, ${roomsAddedCount} new draft project type${roomsAddedCount===1?'':'s'}` : '';
      const errNote = errorCount ? ` — ${errorCount} error${errorCount===1?'':'s'}, check the browser console for details` : '';
      await new Promise(r => setTimeout(r, 800)); // brief buffer so a quick click to another tab doesn't outrace Airtable settling the writes
      showMsg('mq-templates-msg', `✓ Full sync complete — ${createdCount} created, ${replacedCount} fully replaced across ${allShops.length} shop${allShops.length===1?'':'s'}${roomsNote}${errNote}.`, errorCount ? 'error' : 'success');
    } catch(e) {
      console.error('Push to shops failed:', e);
      showMsg('mq-templates-msg', 'Error during push — please try again.', 'error');
    }
  };

  // One item, everywhere at once. Creates it fresh for shops that don't have
  // it yet (same safety net as the bulk push — auto-adds a missing project
  // type as a hidden draft). For shops that already have it, this fully
  // overwrites name/price/units/tags/photo to match the master. NOTE: this is
  // a full overwrite by design right now, while there are no real shop
  // customizations to protect — revisit this once real shops exist and may
  // have renamed/retagged their own copies deliberately.
  window.mqPushSingleTemplateItem = async function(masterItemId) {
    showMsg('mq-templates-msg', 'Pushing this item to all shops...');
    try {
      const master = (window._mqTemplateItems || []).find(m => m.id === masterItemId);
      if (!master) { showMsg('mq-templates-msg', 'Could not find that template item — try refreshing the page.', 'error'); return; }

      const masterShop = await ensureMasterTemplateShop();
      let masterPhotos = {};
      try { masterPhotos = masterShop.fields['Photos'] ? JSON.parse(masterShop.fields['Photos']) : {}; } catch(e) {}
      const masterPhotoUrl = masterPhotos['spec_' + master.id];

      const allShops = await atGet(CONFIG.SHOPS_TABLE, `{Shop name} != "${MASTER_TEMPLATE_SHOP_NAME}"`);
      const adminRooms = window._mqRooms || defaultRoomTypes();
      let createdCount = 0, replacedCount = 0, roomsAddedCount = 0, errorCount = 0;

      for (const shop of allShops) {
        try {
          const shopItems = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shop.fields['Shop name']}", ARRAYJOIN({Shop}))`);
          // Match by tag first, but also fall back to an exact name match —
          // catches orphaned rows left behind by manual Airtable edits that
          // never got (or lost) their tracking tag, so they don't silently
          // block a clean push forever.
          const masterName = (master.fields['Item name'] || '').trim().toLowerCase();
          const existingMatches = shopItems.filter(i =>
            i.fields['Template source ID'] === master.id ||
            (i.fields['Item name'] || '').trim().toLowerCase() === masterName
          );

          let shopRooms = [];
          try { shopRooms = shop.fields['Room types'] ? JSON.parse(shop.fields['Room types']) : []; } catch(e) { shopRooms = []; }
          if (!Array.isArray(shopRooms) || !shopRooms.length) shopRooms = defaultRoomTypes();
          let shopRoomsChanged = false;
          let vr = [];
          try { vr = master.fields['Visible rooms'] ? JSON.parse(master.fields['Visible rooms']) : []; } catch(e) { vr = []; }
          vr.forEach(roomId => {
            if (!shopRooms.find(r => r.id === roomId)) {
              const adminRoomDef = adminRooms.find(r => r.id === roomId);
              shopRooms.push({ id: roomId, name: adminRoomDef ? adminRoomDef.name : roomId, materialAdjPct: 0, installAdjPct: 0, totalAdjPct: 0, description: adminRoomDef ? (adminRoomDef.description || '') : '', active: false, measureText: adminRoomDef ? (adminRoomDef.measureText || '') : '', measureImage: adminRoomDef ? (adminRoomDef.measureImage || '') : '' });
              shopRoomsChanged = true;
              roomsAddedCount++;
            }
          });
          if (shopRoomsChanged) {
            await atUpdate(CONFIG.SHOPS_TABLE, shop.id, { 'Room types': JSON.stringify(shopRooms) });
            shop.fields['Room types'] = JSON.stringify(shopRooms);
          }

          if (existingMatches.length) {
            await Promise.all(existingMatches.map(item => atDelete(CONFIG.SPECIALTY_TABLE, item.id)));
            replacedCount++;
          } else {
            createdCount++;
          }

          const created = await atCreate(CONFIG.SPECIALTY_TABLE, {
            'Shop': [shop.id],
            'Item name': master.fields['Item name'],
            'Special Items': master.fields['Item name'],
            'Price': master.fields['Price'] || 0,
            'Per linear foot': master.fields['Per linear foot'] || false,
            'Per square foot': master.fields['Per square foot'] || false,
            'Offers install choice': master.fields['Offers install choice'] || false,
            'Install price': master.fields['Install price'] || 0,
            'Install mode': master.fields['Install mode'] || 'supply',
          'Description': master.fields['Description'] || '',
          'Category': master.fields['Category'] || '',
          'Pro only': master.fields['Pro only'] || false,
            'Active': false,
            'Visible rooms': master.fields['Visible rooms'] || '[]',
            'Template source ID': master.id,
          });
          if (!created?.id) {
            errorCount++;
            console.error('Failed to create pushed item:', master.fields['Item name'], 'for', shop.fields['Shop name'], created);
            continue;
          }
          if (masterPhotoUrl) {
            let shopPhotos = {};
            try { shopPhotos = shop.fields['Photos'] ? JSON.parse(shop.fields['Photos']) : {}; } catch(e) {}
            shopPhotos['spec_' + created.id] = masterPhotoUrl;
            await atUpdate(CONFIG.SHOPS_TABLE, shop.id, { 'Photos': JSON.stringify(shopPhotos) });
            shop.fields['Photos'] = JSON.stringify(shopPhotos);
          }
        } catch(e) {
          errorCount++;
          console.error('Failed to push item to shop:', shop.fields['Shop name'], e);
        }
      }
      const roomsNote = roomsAddedCount ? `, added ${roomsAddedCount} new draft project type${roomsAddedCount===1?'':'s'}` : '';
      const errNote = errorCount ? ` — ${errorCount} error${errorCount===1?'':'s'}, check the browser console` : '';
      await new Promise(r => setTimeout(r, 800)); // brief buffer so a quick click to another tab doesn't outrace Airtable settling the writes
      showMsg('mq-templates-msg', `✓ "${master.fields['Item name']}" — created for ${createdCount} shop${createdCount===1?'':'s'}, fully replaced for ${replacedCount} shop${replacedCount===1?'':'s'}${roomsNote}${errNote}.`, errorCount ? 'error' : 'success');
    } catch(e) {
      console.error('Single item push failed:', e);
      showMsg('mq-templates-msg', 'Error pushing item — please try again.', 'error');
    }
  };

  function lineItemRoomDisclosure(key, visibleRoomsJson, ids, cat) {
    const rooms = window._mqRooms || defaultRoomTypes();
    let visibleRooms = [];
    try { visibleRooms = visibleRoomsJson ? JSON.parse(visibleRoomsJson) : []; } catch(e) { visibleRooms = []; }
    const summary = roomLinkSummaryText(visibleRooms, rooms);
    const idsAttr = (ids||[]).join(',');
    const checkboxes = rooms.map(r => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;cursor:pointer">
        <input type="checkbox" id="mq-li-room-${key}-${r.id}" ${(!visibleRooms.length || visibleRooms.includes(r.id))?'checked':''} onchange="mqToggleLineItemRoom('${key}','${idsAttr}','${cat||''}')" style="width:auto"/> ${r.name}
      </label>`).join('');
    return `
      <details style="position:relative" ontoggle="mqPositionRoomPanel(this)">
        <summary style="font-size:12px;color:#1d4ed8;cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:#eff6ff;border-radius:6px;width:fit-content">
          <span id="mq-li-room-summary-${key}">${summary}</span>
          <span style="font-size:15px;line-height:1">▾</span>
        </summary>
        <div class="mq-room-panel" style="position:fixed;z-index:10;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px">
          ${checkboxes}
        </div>
      </details>`;
  }

  window.mqToggleLineItemRoom = async function(key, idsCsv, cat) {
    const ids = (idsCsv||'').split(',').filter(Boolean);
    const rooms = window._mqRooms || defaultRoomTypes();
    const checkedIds = rooms
      .filter(r => document.getElementById(`mq-li-room-${key}-${r.id}`)?.checked)
      .map(r => r.id);
    const allChecked = checkedIds.length === rooms.length;
    const toSave = allChecked ? [] : checkedIds;
    const table = cat === 'specialty' ? CONFIG.SPECIALTY_TABLE : CONFIG.LINE_ITEMS_TABLE;
    try {
      await Promise.all(ids.map(id => atUpdate(table, id, { 'Visible rooms': JSON.stringify(toSave) })));
      const summaryEl = document.getElementById(`mq-li-room-summary-${key}`);
      if (summaryEl) summaryEl.textContent = roomLinkSummaryText(toSave, rooms);
    } catch(e) { console.error('Failed to save line item room links', e); }
  };

  // Category-level hiding — e.g. hide the entire Door Styles category for
  // "Door refacing" in one click, instead of unchecking every door one by
  // one. Individual items can still override this (handled widget-side):
  // if an item has its own explicit project-type setting, that wins outright
  // regardless of what the category says.
  function categorySummaryText(hiddenIds, rooms) {
    if (!hiddenIds || !hiddenIds.length) return 'Visible for all project types';
    const names = hiddenIds.map(id => rooms.find(r=>r.id===id)?.name).filter(Boolean);
    return names.length ? `Hidden for: ${names.join(', ')}` : 'Visible for all project types';
  }

  function categoryRoomDisclosure(cat) {
    const rooms = window._mqRooms || defaultRoomTypes();
    const categoryRooms = window._mqCategoryRooms || {};
    const hiddenIds = categoryRooms[cat] || [];
    const summary = categorySummaryText(hiddenIds, rooms);
    const checkboxes = rooms.map(r => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;cursor:pointer">
        <input type="checkbox" id="mq-cat-room-${cat}-${r.id}" ${!hiddenIds.includes(r.id)?'checked':''} onchange="mqToggleCategoryRoom('${cat}','${r.id}',this.checked)" style="width:auto"/> ${r.name}
      </label>`).join('');
    const linkedWarning = LINKED_CABINET_CATS.includes(cat) ? `
      <div style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin-bottom:8px;line-height:1.4">
        ⚠️ Box Materials, Door Styles, and Drawer Configurations are always used together. Unchecking a project type here does the same for all three automatically, which hides the whole Cabinet measurements section on the widget for that project type.
      </div>` : '';
    return `
      <details style="position:relative;margin-bottom:12px" ontoggle="mqPositionRoomPanel(this)">
        <summary style="font-size:12px;font-weight:600;color:#92400e;cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;width:fit-content">
          🗂️ <span id="mq-cat-room-summary-${cat}">${summary}</span>
          <span style="font-size:15px;line-height:1">▾</span>
        </summary>
        <div class="mq-room-panel" style="position:fixed;z-index:10;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:220px">
          ${linkedWarning}
          <div style="font-size:11px;color:#6b7280;margin-bottom:8px;line-height:1.4">Checking/unchecking here sets every item in this category to match. Change one item afterward to make it an exception.</div>
          ${checkboxes}
        </div>
      </details>`;
  }

  // Material, Door Styles, and Drawer Configurations are always used
  // together for cabinet pricing — unchecking any one of them for a project
  // type hides the whole Cabinet measurements section on the widget, so all
  // three need to stay in sync rather than letting them drift apart.
  const LINKED_CABINET_CATS = ['material', 'door', 'drawer'];

  async function applyCategoryRoomChange(cat, roomId, checked) {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const rooms = window._mqRooms || defaultRoomTypes();
    const allRoomIds = rooms.map(r => r.id);

    // Update the category-level hidden list for this one room
    if (!window._mqCategoryRooms) window._mqCategoryRooms = {};
    let hidden = window._mqCategoryRooms[cat] || [];
    hidden = checked ? hidden.filter(id => id !== roomId) : [...new Set([...hidden, roomId])];
    window._mqCategoryRooms[cat] = hidden;

    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Category rooms': JSON.stringify(window._mqCategoryRooms) });
      shopRec.fields['Category rooms'] = JSON.stringify(window._mqCategoryRooms);
    } catch(e) { console.error('Failed to save category room hiding', e); return; }

    const summaryEl = document.getElementById(`mq-cat-room-summary-${cat}`);
    if (summaryEl) summaryEl.textContent = categorySummaryText(hidden, rooms);
    const cb = document.getElementById(`mq-cat-room-${cat}-${roomId}`);
    if (cb) cb.checked = checked;

    // Bulk-sync every item in this category: take each item's current
    // effective per-room state, flip just this one room to match the
    // category change, and save as an explicit list. From this point on,
    // manually changing one item's own checkbox is a real override — until
    // the category checkbox for that same room gets toggled again.
    const items = cat === 'specialty' ? (window._mqSpecItemsList || []) : ((window._mqByCategory || {})[cat] || []);
    const table = cat === 'specialty' ? CONFIG.SPECIALTY_TABLE : CONFIG.LINE_ITEMS_TABLE;

    await Promise.all(items.map(async (item) => {
      let current = [];
      try { current = item.visibleRooms ? JSON.parse(item.visibleRooms) : []; } catch(e) { current = []; }
      const effectiveSet = new Set(current.length ? current : allRoomIds); // empty = implicit all
      if (checked) effectiveSet.add(roomId); else effectiveSet.delete(roomId);
      const newList = allRoomIds.filter(id => effectiveSet.has(id));
      const finalList = newList.length === allRoomIds.length ? [] : newList; // all-checked collapses back to "visible everywhere"
      const ids = item.ids || [item.id];
      try {
        await Promise.all(ids.map(id => atUpdate(table, id, { 'Visible rooms': JSON.stringify(finalList) })));
        item.visibleRooms = JSON.stringify(finalList);
      } catch(e) { console.error('Failed to bulk-sync item room links', e); }

      // Reflect the sync visually on that item's own checkbox/summary, if rendered
      const key = cat === 'specialty' ? `spec_${item.id}` : `li_${cat}_${(item.baseName||'').replace(/[^a-z0-9]/gi,'_').toLowerCase()}`;
      const itemCb = document.getElementById(`mq-li-room-${key}-${roomId}`);
      if (itemCb) itemCb.checked = checked;
      const itemSummaryEl = document.getElementById(`mq-li-room-summary-${key}`);
      if (itemSummaryEl) itemSummaryEl.textContent = roomLinkSummaryText(finalList, rooms);
    }));
  }

  window.mqToggleCategoryRoom = async function(cat, roomId, checked) {
    await applyCategoryRoomChange(cat, roomId, checked);
    // If this is one of the three linked cabinet categories, mirror the exact
    // same change to the other two so they never drift out of sync.
    if (LINKED_CABINET_CATS.includes(cat)) {
      const others = LINKED_CABINET_CATS.filter(c => c !== cat);
      await Promise.all(others.map(otherCat => applyCategoryRoomChange(otherCat, roomId, checked)));
      showMsg('mq-products-msg', `✓ Also updated ${others.map(c => CAT_DISPLAY_NAMES[c]).join(' and ')} to match, since they're always used together.`);
    }
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
      const existing = await loadSpecialty(shopRec.fields['Shop name']);
      // Strictly lower than the current lowest Sort order — not just 0 —
      // so a brand new item always lands unambiguously first, even if
      // other items also happen to be sitting at 0 already.
      const minSort = existing.length ? Math.min(0, ...existing.map(r => r.fields['Sort order'] || 0)) : 0;
      const created = await atCreate(CONFIG.SPECIALTY_TABLE, {
        'Item name': 'New item',
        'Shop': [shopRec.id],
        'Price': 0,
        'Active': true,
        'Per linear foot': false,
        'Sort order': minSort - 1,
      });
      const specs = await loadSpecialty(shopRec.fields['Shop name']);
      renderSpecialty(specs, shopRec);
      showMsg('mq-spec-msg', '✓ Item added at the top — edit the name and price below.');
      // Scroll to it and focus the name field so it's impossible to miss,
      // rather than landing somewhere off-screen with no visible sign
      // anything happened.
      if (created?.id) {
        setTimeout(() => {
          const nameInput = document.getElementById('mq-spec-name-' + created.id);
          if (nameInput) {
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nameInput.focus();
            nameInput.select();
          }
        }, 50);
      }
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
    leads = sortLeadsArray(leads);
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
  let _mqSignBgImage = null;
  let _mqSignOverlayOpacity = 0.62;
  let _mqGraphicHeadline = '';
  let _mqQrHeadline = '';
  let _mqSignHeadline = '';
  let _mqQrCustomColor = '';
  let _mqSignCustomColor = '';
  let _mqQrLibLoading = null;

  let _mqHeadlineSaveTimer = null;
  function saveHeadlinesDebounced(shopRecord) {
    clearTimeout(_mqHeadlineSaveTimer);
    _mqHeadlineSaveTimer = setTimeout(async () => {
      try {
        const payload = JSON.stringify({ graphic: _mqGraphicHeadline, qr: _mqQrHeadline, sign: _mqSignHeadline, qrColor: _mqQrCustomColor, signColor: _mqSignCustomColor });
        await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Marketing headlines': payload });
        shopRecord.fields['Marketing headlines'] = payload;
      } catch(e) {}
    }, 800);
  }

  // Shared collapsible toggle for every card on the Marketing Kit page —
  // it was getting cluttered with everything always open at once, so each
  // section now starts closed and opens on its own when clicked.
  window.mqToggleMkSection = function(key) {
    const body = document.getElementById(`mq-mk-body-${key}`);
    const arrow = document.getElementById(`mq-mk-arrow-${key}`);
    if (!body) return;
    const opening = body.style.display === 'none';
    body.style.display = opening ? 'block' : 'none';
    if (arrow) arrow.style.transform = opening ? 'rotate(0deg)' : 'rotate(-90deg)';
    // Collapsing/expanding a section doesn't scroll the page, so the
    // Poster Designer's floating preview needs its own explicit re-check
    // here too — it can't rely on the scroll-based observer alone.
    if (typeof window._mqPdUpdateStickyVisibility === 'function') {
      window._mqPdUpdateStickyVisibility();
    }
  };

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

    const dmTemplate = `Hi [Name]! Just wanted to let you know ${shopName} now has an instant online quote tool if you ever want a quick ballpark on a future project — no need to wait for a callback. Here's the link if you ever want to check it out: ${quoteLink}`;

    // Google Fonts import — included in both blocks independently (harmless
    // if both end up on the page together; browsers dedupe identical
    // stylesheet URLs, so this is safe either way).
    const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;

    const heroHeaderHTML = `${fontLinks}
<div style="text-align:center;padding:2rem 1rem 1.5rem;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#b8763a;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
    Instant Pricing
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
  </div>
  <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:600;color:#3d3830;line-height:1.2;margin:0 0 0.75rem;letter-spacing:-0.01em">Get your cabinet estimate<br/>in under 2 minutes</h2>
  <p style="font-size:14px;color:#5c5650;line-height:1.7;max-width:460px;margin:0 auto">No phone tag, no awkward sales call. Fill in a few details and we'll send you a ballpark range you can actually plan around.</p>
</div>`;

    const trustBarHTML = `${fontLinks}
<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.5rem;padding:14px 16px;background:#faf8f5;border:1px solid rgba(61,56,48,0.12);border-radius:10px;margin:30px 0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#5c5650"><span style="font-size:15px">✅</span><span>No commitment required</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#5c5650"><span style="font-size:15px">📧</span><span>Results sent to your inbox</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#5c5650"><span style="font-size:15px">🔒</span><span>We never sell your info</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#5c5650"><span style="font-size:15px">⚡</span><span>Instant ballpark estimate</span></div>
</div>`;

    const escapeHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const socialEl = el('mq-mk-social');
    function renderSocialPosts(posts) {
      if (!socialEl) return;
      socialEl.innerHTML = posts.map((post, i) => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(post)}</div>
          <button class="mq-btn mq-btn-sm" data-copy-idx="${i}">Copy</button>
        </div>`).join('');
      socialEl.querySelectorAll('button[data-copy-idx]').forEach(btn => {
        btn.onclick = () => mqCopyText(posts[parseInt(btn.dataset.copyIdx, 10)], btn);
      });
    }
    renderSocialPosts(socialPosts);

    const postLinkInput = el('mq-mk-post-link');
    const postLinkApplyBtn = el('mq-mk-post-link-apply');
    if (postLinkInput) postLinkInput.value = _mqCustomPostLink || defaultQuoteLink;
    if (postLinkApplyBtn) {
      postLinkApplyBtn.onclick = async () => {
        const val = (postLinkInput?.value || '').trim();
        _mqCustomPostLink = val;
        const newLink = val || defaultQuoteLink;
        renderSocialPosts(buildSocialPosts(newLink));
        if (typeof window._mqRedrawQrPoster === 'function') window._mqRedrawQrPoster();
        if (typeof window._mqRedrawSign === 'function') window._mqRedrawSign();
        postLinkApplyBtn.textContent = 'Saving...';
        try {
          await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Marketing link': val });
          shopRecord.fields['Marketing link'] = val;
          postLinkApplyBtn.textContent = 'Saved ✓';
        } catch(e) {
          postLinkApplyBtn.textContent = 'Error — try again';
        }
        setTimeout(() => { postLinkApplyBtn.textContent = 'Apply'; }, 1800);
      };
    }

    const dmEl = el('mq-mk-dm');
    if (dmEl) {
      dmEl.innerHTML = `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(dmTemplate)}</div>
          <button class="mq-btn mq-btn-sm" id="mq-mk-dm-copy-btn">Copy</button>
        </div>`;
      const dmCopyBtn = el('mq-mk-dm-copy-btn');
      if (dmCopyBtn) dmCopyBtn.onclick = () => mqCopyText(dmTemplate, dmCopyBtn);
    }

    const headerDisplay = el('mq-mk-header-display');
    const headerCopyBtn = el('mq-mk-header-copy');
    const headerPreview = el('mq-mk-header-preview');
    if (headerDisplay) headerDisplay.textContent = heroHeaderHTML;
    if (headerCopyBtn) headerCopyBtn.onclick = () => mqCopyText(heroHeaderHTML, headerCopyBtn);
    if (headerPreview) headerPreview.innerHTML = heroHeaderHTML;

    // Store raw codes so the combined embed builder on the Embed tab can access them
    window._mqRawHeaderCode = heroHeaderHTML;
    window._mqRawTrustCode  = trustBarHTML;
    // Trigger combined embed display to populate now that codes are ready
    if (typeof window.mqUpdateCombinedEmbed === 'function') window.mqUpdateCombinedEmbed();

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
      let graphicHeadline = _mqGraphicHeadline || 'Get your cabinet quote in under 2 minutes';

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
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

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

        // Strong drop shadow on all text from here down — keeps it readable on any photo, even light ones
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 44px -apple-system, sans-serif';
        ctx.fillText(shopName, pad + chipSize + 28, pad + chipSize/2 - 4);
        ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
        ctx.fillText(shopName, pad + chipSize + 28, pad + chipSize/2 - 4);
        ctx.shadowBlur = 26; ctx.shadowOffsetY = 4;
        if (city) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '400 30px -apple-system, sans-serif';
          ctx.fillText(city, pad + chipSize + 28, pad + chipSize/2 + 36);
        }

        // Eyebrow
        let y = pad + chipSize + 130;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 32px -apple-system, sans-serif';
        ctx.fillText('INSTANT PRICING', pad, y);

        // Headline — double shadow pass for extra weight
        y += 80;
        const headlineFont = '600 80px -apple-system, sans-serif';
        ctx.font = headlineFont;
        ctx.fillStyle = '#ffffff';
        const headlineLines = wrapText(graphicHeadline, headlineFont, W - pad*2);
        headlineLines.forEach(line => {
          ctx.font = headlineFont;
          ctx.fillText(line, pad, y);
          ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
          ctx.fillText(line, pad, y);
          ctx.shadowBlur = 26; ctx.shadowOffsetY = 4;
          y += 92;
        });

        // Subtext — double shadow pass too
        y += 30;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '400 38px -apple-system, sans-serif';
        ctx.fillText('No phone calls. No waiting. Just your price.', pad, y);
        ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
        ctx.fillText('No phone calls. No waiting. Just your price.', pad, y);

        // Turn off shadow before drawing the solid white CTA pill (it has its own shadow below)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Bottom CTA pill — bigger, more prominent, own drop shadow for depth
        const ctaH = 116;
        const ctaW = 400;
        const ctaY = H - pad - ctaH;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(pad, ctaY, ctaW, ctaH, 22);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '700 46px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Get a quote →', pad + ctaW/2, ctaY + ctaH/2 + 2);
      }

      drawGraphic();

      const graphicHeadlineInput = el('mq-mk-graphic-headline');
      if (graphicHeadlineInput) {
        graphicHeadlineInput.value = _mqGraphicHeadline || '';
        graphicHeadlineInput.oninput = () => {
          const val = graphicHeadlineInput.value.trim();
          _mqGraphicHeadline = val;
          graphicHeadline = val || 'Get your cabinet quote in under 2 minutes';
          drawGraphic();
          saveHeadlinesDebounced(shopRecord);
        };
      }

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
      const brandColor = shopRecord.fields['Brand colour'] || '#1a1a1a';
      let qrBgImage = _mqQrBgImage;
      let qrOverlayOpacity = _mqQrOverlayOpacity;
      let qrLibState = 'loading'; // 'loading' | 'ready' | 'failed'
      let qrHeadline = _mqQrHeadline || 'Scan for an instant price';
      let qrCustomColor = _mqQrCustomColor || '';
      let qrFontFamily = '-apple-system, sans-serif';
      let qrLetterSpacing = 0;

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

      function shadeColorQr(hex, percent) {
        try {
          hex = hex.replace('#','');
          let r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
          const amt = Math.round(2.55 * percent);
          r = Math.max(0, Math.min(255, r + amt));
          g = Math.max(0, Math.min(255, g + amt));
          b = Math.max(0, Math.min(255, b + amt));
          return `rgb(${r},${g},${b})`;
        } catch(e) { return hex; }
      }

      function getTextColorQr(hex) {
        try {
          hex = hex.replace('#','');
          const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
        } catch(e) { return '#ffffff'; }
      }

      function shadowText(text, x, y, font, fillColor) {
        qrCtx.font = font;
        qrCtx.textAlign = 'center';
        qrCtx.textBaseline = 'alphabetic';
        qrCtx.save();
        qrCtx.shadowColor = 'rgba(0,0,0,0.9)';
        qrCtx.shadowBlur = 28;
        qrCtx.shadowOffsetY = 4;
        qrCtx.fillStyle = fillColor;
        qrCtx.fillText(text, x, y);
        // Second pass for extra weight — blurred shadows alone can look soft, so stack two
        qrCtx.shadowBlur = 16;
        qrCtx.shadowOffsetY = 2;
        qrCtx.fillText(text, x, y);
        qrCtx.restore();
      }

      function drawQrPoster() {
        qrCtx.clearRect(0,0,QW,QH);
        const baseColor = qrCustomColor || brandColor;
        const bannerTextColor = getTextColorQr(baseColor);

        // ── Solid banner at the top for the shop name — same legibility guarantee as the yard sign ──
        const bannerH = 220;
        const bannerGrad = qrCtx.createLinearGradient(0, 0, 0, bannerH);
        bannerGrad.addColorStop(0, baseColor);
        bannerGrad.addColorStop(1, shadeColorQr(baseColor, -18));
        qrCtx.fillStyle = bannerGrad;
        qrCtx.fillRect(0, 0, QW, bannerH);

        qrCtx.textAlign = 'center';
        qrCtx.textBaseline = 'alphabetic';
        qrCtx.fillStyle = bannerTextColor;
        let nameFontSize = 64;
        let nameFont = `800 ${nameFontSize}px ${qrFontFamily}`;
        let nameLines = wrapTextQr(shopName, nameFont, QW - 140);
        while (nameLines.length > 1 && nameFontSize > 40) {
          nameFontSize -= 6;
          nameFont = `800 ${nameFontSize}px ${qrFontFamily}`;
          nameLines = wrapTextQr(shopName, nameFont, QW - 140);
        }
        qrCtx.font = nameFont;
        qrCtx.fillText(nameLines[0], QW/2, bannerH/2 + nameFontSize*0.34);

        // ── Photo / solid background fills the rest ──
        const bodyY = bannerH;
        const bodyH = QH - bannerH;
        let posterTextColor = '#ffffff';

        if (qrBgImage) {
          const imgRatio = qrBgImage.width / qrBgImage.height;
          const areaRatio = QW / bodyH;
          let dw, dh, dx, dy;
          if (imgRatio > areaRatio) {
            dh = bodyH; dw = bodyH * imgRatio; dx = (QW - dw) / 2; dy = bodyY;
          } else {
            dw = QW; dh = QW / imgRatio; dx = 0; dy = bodyY - (dh - bodyH) / 2;
          }
          qrCtx.save();
          qrCtx.beginPath();
          qrCtx.rect(0, bodyY, QW, bodyH);
          qrCtx.clip();
          qrCtx.drawImage(qrBgImage, dx, dy, dw, dh);
          qrCtx.fillStyle = `rgba(10,10,10,${qrOverlayOpacity * 0.6})`;
          qrCtx.fillRect(0, bodyY, QW, bodyH);
          qrCtx.restore();
        } else {
          posterTextColor = getTextColorQr(baseColor);
          const grad = qrCtx.createLinearGradient(0, bodyY, 0, QH);
          grad.addColorStop(0, shadeColorQr(baseColor, 4));
          grad.addColorStop(1, shadeColorQr(baseColor, -26));
          qrCtx.fillStyle = grad;
          qrCtx.fillRect(0, bodyY, QW, bodyH);
        }

        const pad = 84;
        qrCtx.textAlign = 'center';

        // Treat headline + QR + subtext as ONE block, then center that whole block
        // in the space between the banner and the CTA button — much more predictable.
        const qrSize = 520;
        const cardPad = 40;
        const ctaHForCalc = 116;
        const headlineFont = `700 62px ${qrFontFamily}`;
        const lines = wrapTextQr(qrHeadline, headlineFont, QW - pad*2);
        const headlineLineH = 74;
        const subtextLineH = 44;

        const gapHeadlineToQr = 80;   // space between bottom of headline and top of QR card
        const gapQrToSubtext = 80;    // space between bottom of QR card and subtext
        const qrCardH = qrSize + cardPad*2;

        // Total height = all headline lines + gap + QR card + gap + one subtext line
        const totalBlockH = (lines.length * headlineLineH) + gapHeadlineToQr + qrCardH + gapQrToSubtext + subtextLineH;

        const availTop = bannerH;
        const availBottom = QH - pad - ctaHForCalc - 40;
        const blockTop = availTop + Math.max(0, (availBottom - availTop - totalBlockH) / 2);

        // Headline — baseline of first line sits ~0.75x the line height down from blockTop
        let y = blockTop + headlineLineH * 0.75;
        lines.forEach(line => {
          qrCtx.letterSpacing = qrLetterSpacing + 'px';
          shadowText(line, QW/2, y, headlineFont, posterTextColor);
          qrCtx.letterSpacing = '0px';
          y += headlineLineH;
        });

        // QR card sits right after the headline block, with a fixed gap
        const qrX = (QW - qrSize) / 2;
        const qrY = blockTop + (lines.length * headlineLineH) + gapHeadlineToQr;

        if (!qrLink) {
          drawPlaceholderCard(qrX, qrY, qrSize, cardPad,
            ['No link added yet'],
            'Set your quote page link at the top of this page');
          y = qrY + qrSize + cardPad + gapQrToSubtext;
        } else if (qrLibState !== 'ready') {
          drawPlaceholderCard(qrX, qrY, qrSize, cardPad,
            [qrLibState === 'failed' ? 'Couldn\u2019t load QR code' : 'Loading QR code\u2026'],
            qrLibState === 'failed' ? 'Check your connection and reopen this tab' : null);
          y = qrY + qrSize + cardPad + gapQrToSubtext;
        } else {
          try {
            const qr = window.mqQrGen(0, 'M');
            qr.addData(qrLink);
            qr.make();
            const count = qr.getModuleCount();
            const cell = qrSize / count;

            // Card with subtle shadow for depth
            qrCtx.save();
            qrCtx.shadowColor = 'rgba(0,0,0,0.35)';
            qrCtx.shadowBlur = 30;
            qrCtx.shadowOffsetY = 12;
            qrCtx.fillStyle = '#ffffff';
            qrCtx.beginPath();
            qrCtx.roundRect(qrX - cardPad, qrY - cardPad, qrSize + cardPad*2, qrSize + cardPad*2, 28);
            qrCtx.fill();
            qrCtx.restore();

            // Thin brand-colour border ring around the QR for polish
            qrCtx.strokeStyle = brandColor;
            qrCtx.lineWidth = 4;
            qrCtx.beginPath();
            qrCtx.roundRect(qrX - cardPad + 10, qrY - cardPad + 10, qrSize + cardPad*2 - 20, qrSize + cardPad*2 - 20, 20);
            qrCtx.stroke();

            qrCtx.fillStyle = '#1a1a1a';
            for (let row = 0; row < count; row++) {
              for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) {
                  qrCtx.fillRect(qrX + col*cell, qrY + row*cell, cell+0.5, cell+0.5);
                }
              }
            }
            y = qrY + qrSize + cardPad + gapQrToSubtext;
          } catch(e) {
            drawPlaceholderCard(qrX, qrY, qrSize, cardPad, ['Couldn\u2019t generate QR code'], null);
            y = qrY + qrSize + cardPad + gapQrToSubtext;
          }
        }

        // Subtext with shadow
        shadowText('No phone calls. No waiting.', QW/2, y, '500 36px -apple-system, sans-serif', posterTextColor);

        // Bottom CTA button — bigger, bolder, brand-coloured accent border
        const ctaH = 116;
        const ctaW = 440;
        const ctaY = QH - pad - ctaH;
        const ctaX = (QW - ctaW) / 2;
        qrCtx.save();
        qrCtx.shadowColor = 'rgba(0,0,0,0.4)';
        qrCtx.shadowBlur = 24;
        qrCtx.shadowOffsetY = 8;
        qrCtx.fillStyle = '#ffffff';
        qrCtx.beginPath();
        qrCtx.roundRect(ctaX, ctaY, ctaW, ctaH, 22);
        qrCtx.fill();
        qrCtx.restore();
        qrCtx.fillStyle = '#1a1a1a';
        qrCtx.font = '700 48px -apple-system, sans-serif';
        qrCtx.textAlign = 'center';
        qrCtx.textBaseline = 'middle';
        qrCtx.fillText('Get a quote \u2192', QW/2, ctaY + ctaH/2 + 2);
        qrCtx.textBaseline = 'alphabetic';
      }

      function getQrLink() {
        return _mqCustomPostLink || defaultQuoteLink;
      }

      let qrLink = getQrLink();

      window._mqRedrawQrPoster = () => { qrLink = getQrLink(); drawQrPoster(); };

      drawQrPoster();
      loadQrLib().then(() => { qrLink = getQrLink(); drawQrPoster(); });

      const qrHeadlineInput = el('mq-mk-qr-headline');
      if (qrHeadlineInput) {
        qrHeadlineInput.value = _mqQrHeadline || '';
        qrHeadlineInput.oninput = () => {
          const val = qrHeadlineInput.value.trim();
          _mqQrHeadline = val;
          qrHeadline = val || 'Scan for an instant price';
          drawQrPoster();
          saveHeadlinesDebounced(shopRecord);
        };
      }

      const qrFontSelect = el('mq-mk-qr-font');
      if (qrFontSelect) {
        qrFontSelect.onchange = () => {
          qrFontFamily = qrFontSelect.value;
          drawQrPoster();
        };
      }

      const qrLetterSpacingSlider = el('mq-mk-qr-letter-spacing');
      const qrLetterSpacingVal = el('mq-mk-qr-letter-spacing-val');
      if (qrLetterSpacingSlider) {
        qrLetterSpacingSlider.oninput = () => {
          qrLetterSpacing = parseInt(qrLetterSpacingSlider.value, 10);
          if (qrLetterSpacingVal) qrLetterSpacingVal.textContent = qrLetterSpacing + 'px';
          drawQrPoster();
        };
      }

      const qrColorInput = el('mq-mk-qr-color');
      const qrColorResetBtn = el('mq-mk-qr-color-reset');
      if (qrColorInput) {
        qrColorInput.value = qrCustomColor || '#262422';
        qrColorInput.oninput = () => {
          qrCustomColor = qrColorInput.value;
          _mqQrCustomColor = qrCustomColor;
          drawQrPoster();
          saveHeadlinesDebounced(shopRecord);
        };
      }
      if (qrColorResetBtn) {
        qrColorResetBtn.onclick = () => {
          qrCustomColor = '';
          _mqQrCustomColor = '';
          if (qrColorInput) qrColorInput.value = '#262422';
          drawQrPoster();
          saveHeadlinesDebounced(shopRecord);
        };
      }

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
            alert('Please add a link at the top of this page first.');
            return;
          }
          const link = document.createElement('a');
          link.download = (shopName.replace(/[^a-z0-9]/gi,'-').toLowerCase() || 'quote-poster') + '-qr-poster.png';
          link.href = qrCanvas.toDataURL('image/png');
          link.click();
        };
      }
    }

    // signLink is used by both the QR poster above and the Poster Designer
    // below — declared here, outside any one feature's own block, so it's
    // never at risk of going undeclared if one of those features' own
    // canvas doesn't exist on the page.
    let signLink = _mqCustomPostLink || defaultQuoteLink;

      // ── Custom Poster & Sign Designer ──────────────────────────────────
      // Deliberately its own self-contained canvas system rather than
      // reusing the QR poster's helper functions, since those are scoped to
      // that canvas's own context. First template: "Curved Split" — a
      // smooth S-curve dividing a text/logo panel from a photo panel, in
      // both portrait (poster) and landscape (yard sign) orientations.
      // More template styles get added onto this same pattern later.
      const pdCanvas = el('mq-pd-canvas');
      if (pdCanvas) {
        const pdCtx = pdCanvas.getContext('2d');
        let pdOrientation = 'portrait';
        let pdTemplate = 'curved-split';
        let pdPhotoImage = null;
        let pdOwnLogoImage = null; // uploaded specifically here, not shop info's logo
        let pdBgImage = null; // optional uploaded background texture/image
        const pdShopName = shopRecord.fields['Shop name'] || 'Your Shop';

        function pdWrapText(text, font, maxWidth) {
          pdCtx.font = font;
          const words = text.split(' ');
          const lines = [];
          let line = '';
          words.forEach(word => {
            const test = line ? line + ' ' + word : word;
            if (pdCtx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
            else line = test;
          });
          if (line) lines.push(line);
          return lines;
        }

        // Reads the shared text size/spacing/position controls once per
        // draw — same five values used by every template, so a slider
        // dragged here consistently affects whichever style is selected.
        // Turns on a soft drop shadow for whatever text gets drawn next —
        // called right before a template's text-drawing section, and
        // cleared right after, so it never accidentally applies to the
        // photo, QR code, or button too.
        function pdSetTextShadow() {
          if (el('mq-pd-text-shadow')?.checked) {
            pdCtx.shadowColor = 'rgba(0,0,0,0.45)';
            pdCtx.shadowBlur = 8;
            pdCtx.shadowOffsetX = 2;
            pdCtx.shadowOffsetY = 3;
          }
        }
        function pdClearShadow() {
          pdCtx.shadowColor = 'transparent';
          pdCtx.shadowBlur = 0;
          pdCtx.shadowOffsetX = 0;
          pdCtx.shadowOffsetY = 0;
        }

        function pdGetTextControls() {
          return {
            preMult: (parseInt(el('mq-pd-size-pre')?.value,10)||100)/100,
            nameMult: (parseInt(el('mq-pd-size-name')?.value,10)||100)/100,
            tagMult: (parseInt(el('mq-pd-size-tag')?.value,10)||100)/100,
            lineMult: (parseInt(el('mq-pd-line-spacing')?.value,10)||100)/100,
            offsetPct: (parseInt(el('mq-pd-text-offset')?.value,10)||0)/100,
            preText: el('mq-pd-pre-text')?.value || 'Another project by',
            preColor: el('mq-pd-pre-color')?.value || '#6b6b6b',
            tagColor: el('mq-pd-tag-color')?.value || '#4b4b4b'
          };
        }

        // Reads the shared QR-code/quote-button settings once per draw.
        function pdGetQrButtonSettings() {
          return {
            qrEnabled: el('mq-pd-qr-enabled')?.checked || false,
            qrSizeMult: (parseInt(el('mq-pd-qr-size')?.value,10)||100)/100,
            qrOffsetPct: (parseInt(el('mq-pd-qr-position')?.value,10)||0)/100,
            btnEnabled: el('mq-pd-btn-enabled')?.checked || false,
            btnOffsetPct: (parseInt(el('mq-pd-btn-position')?.value,10)||0)/100
          };
        }

        // Draws a QR code centered at (cx, cy) — a white rounded card with a
        // subtle shadow, same look as the existing yard sign's QR code.
        // Silently does nothing if there's no quote link yet or the QR
        // library hasn't loaded, same fallback used elsewhere.
        function pdDrawQrCode(cx, cy, size) {
          if (!signLink || !window.mqQrGen) return;
          try {
            const qr = window.mqQrGen(0, 'M');
            qr.addData(signLink);
            qr.make();
            const count = qr.getModuleCount();
            const cardPad = size * 0.09;
            const x = cx - size/2, y = cy - size/2;
            const cell = size / count;

            pdCtx.save();
            pdCtx.shadowColor = 'rgba(0,0,0,0.35)';
            pdCtx.shadowBlur = 22;
            pdCtx.shadowOffsetY = 6;
            pdCtx.fillStyle = '#ffffff';
            pdCtx.beginPath();
            pdCtx.roundRect(x - cardPad, y - cardPad, size + cardPad*2, size + cardPad*2, 16);
            pdCtx.fill();
            pdCtx.restore();

            pdCtx.fillStyle = '#1a1a1a';
            for (let row = 0; row < count; row++) {
              for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) pdCtx.fillRect(x + col*cell, y + row*cell, cell+0.5, cell+0.5);
              }
            }
          } catch(e) {}
        }

        // Draws a rounded "Get a Free Quote" pill button centered at (cx, cy).
        // Fills the whole canvas background — an uploaded image if the shop
        // turned that on, otherwise whatever solid colour or gradient the
        // colour pickers are set to. Centralized here since several
        // templates need the exact same background-fill behavior.
        function pdFillBackground(W, H, bgColor, bgColor2, bgGradient) {
          const useImage = el('mq-pd-bg-image-enabled')?.checked && pdBgImage;
          if (useImage) {
            pdDrawPhotoInRect(pdBgImage, 0, 0, W, H);
            return;
          }
          if (bgGradient) {
            const isPortrait = pdOrientation === 'portrait';
            const g = isPortrait ? pdCtx.createLinearGradient(0,0,0,H) : pdCtx.createLinearGradient(0,0,W,0);
            g.addColorStop(0, bgColor); g.addColorStop(1, bgColor2);
            pdCtx.fillStyle = g;
          } else {
            pdCtx.fillStyle = bgColor;
          }
          pdCtx.fillRect(0, 0, W, H);
        }

        function pdDrawGetQuoteButton(cx, cy, color) {
          const w = 340, h = 84;
          pdCtx.save();
          pdCtx.shadowColor = 'rgba(0,0,0,0.3)';
          pdCtx.shadowBlur = 16;
          pdCtx.shadowOffsetY = 4;
          pdCtx.fillStyle = color;
          pdCtx.beginPath();
          pdCtx.roundRect(cx - w/2, cy - h/2, w, h, h/2);
          pdCtx.fill();
          pdCtx.restore();
          pdCtx.fillStyle = pdMutedTextColorFor(color) === '#5b5b5b' ? '#1a1a1a' : '#ffffff';
          pdCtx.font = '700 34px -apple-system, sans-serif';
          pdCtx.textAlign = 'center'; pdCtx.textBaseline = 'middle';
          pdCtx.fillText('Get a Free Quote', cx, cy + 2);
          pdCtx.textBaseline = 'alphabetic';
        }

        function pdShade(hex, percent) {
          try {
            hex = hex.replace('#','');
            let r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
            const amt = Math.round(2.55 * percent);
            r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
            return `rgb(${r},${g},${b})`;
          } catch(e) { return hex; }
        }

        // Picks a readable dark or light grey for secondary text based on
        // how light or dark the chosen background actually is — since a
        // hardcoded grey tuned for white would disappear on a dark
        // background someone picks, and vice versa.
        function pdMutedTextColorFor(hex) {
          try {
            hex = hex.replace('#','');
            const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.55 ? '#5b5b5b' : '#d4d4d4';
          } catch(e) { return '#6b6b6b'; }
        }

        function pdDrawPhotoInRect(img, x, y, w, h) {
          if (!img) {
            pdCtx.fillStyle = '#e5e7eb';
            pdCtx.fillRect(x, y, w, h);
            pdCtx.fillStyle = '#9ca3af';
            pdCtx.font = '500 32px -apple-system, sans-serif';
            pdCtx.textAlign = 'center';
            pdCtx.textBaseline = 'middle';
            pdCtx.fillText('Upload a photo above', x + w/2, y + h/2);
            pdCtx.textBaseline = 'alphabetic';
            return;
          }
          const imgRatio = img.width / img.height;
          const areaRatio = w / h;
          let dw, dh, dx, dy;
          if (imgRatio > areaRatio) { dh = h; dw = h * imgRatio; dx = x - (dw - w)/2; dy = y; }
          else { dw = w; dh = w / imgRatio; dx = x; dy = y - (dh - h)/2; }
          pdCtx.drawImage(img, dx, dy, dw, dh);
        }

        function drawCurvedSplit() {
          const W = pdCanvas.width, H = pdCanvas.height;
          pdCtx.clearRect(0, 0, W, H);
          const isPortrait = pdOrientation === 'portrait';
          const textMode = el('mq-pd-text-mode')?.value || 'text';
          const tagline = el('mq-pd-tagline')?.value || '';
          const shapeColor = el('mq-pd-shape-color')?.value || '#1a3a6b';
          const shapeColor2 = el('mq-pd-shape-color2')?.value || pdShade(shapeColor, -30);
          const useGradient = el('mq-pd-shape-gradient')?.checked || false;
          const accentColor = el('mq-pd-accent-color')?.value || '#c9a24b';
          const bgColor = el('mq-pd-bg-color')?.value || '#ffffff';
          const bgColor2 = el('mq-pd-bg-color2')?.value || pdShade(bgColor, -25);
          const bgGradient = el('mq-pd-bg-gradient')?.checked || false;
          const bandHalf = isPortrait ? H*0.014 : W*0.010;
          const tc = pdGetTextControls();

          pdFillBackground(W, H, bgColor, bgColor2, bgGradient);

          // Photo zone, clipped to the curve
          pdCtx.save();
          pdCtx.beginPath();
          if (isPortrait) {
            const splitY = H * 0.46;
            pdCtx.moveTo(0, splitY);
            pdCtx.bezierCurveTo(W*0.35, splitY - H*0.07, W*0.65, splitY + H*0.07, W, splitY);
            pdCtx.lineTo(W, H); pdCtx.lineTo(0, H); pdCtx.closePath();
          } else {
            const splitX = W * 0.42;
            pdCtx.moveTo(splitX, 0);
            pdCtx.bezierCurveTo(splitX - W*0.06, H*0.35, splitX + W*0.06, H*0.65, splitX, H);
            pdCtx.lineTo(W, H); pdCtx.lineTo(W, 0); pdCtx.closePath();
          }
          pdCtx.clip();
          if (isPortrait) pdDrawPhotoInRect(pdPhotoImage, 0, H*0.32, W, H*0.74);
          else pdDrawPhotoInRect(pdPhotoImage, W*0.28, 0, W*0.75, H);
          pdCtx.restore();

          // The customizable colored "shape" — a filled curved ribbon
          // sitting right along the boundary between the text panel and the
          // photo, solid or gradient depending on the controls above.
          pdCtx.save();
          pdCtx.beginPath();
          if (isPortrait) {
            const splitY = H * 0.46;
            pdCtx.moveTo(0, splitY - bandHalf);
            pdCtx.bezierCurveTo(W*0.35, splitY - H*0.07 - bandHalf, W*0.65, splitY + H*0.07 - bandHalf, W, splitY - bandHalf);
            pdCtx.lineTo(W, splitY + bandHalf);
            pdCtx.bezierCurveTo(W*0.65, splitY + H*0.07 + bandHalf, W*0.35, splitY - H*0.07 + bandHalf, 0, splitY + bandHalf);
            pdCtx.closePath();
          } else {
            const splitX = W * 0.42;
            pdCtx.moveTo(splitX - bandHalf, 0);
            pdCtx.bezierCurveTo(splitX - W*0.06 - bandHalf, H*0.35, splitX + W*0.06 - bandHalf, H*0.65, splitX - bandHalf, H);
            pdCtx.lineTo(splitX + bandHalf, H);
            pdCtx.bezierCurveTo(splitX + W*0.06 + bandHalf, H*0.65, splitX - W*0.06 + bandHalf, H*0.35, splitX + bandHalf, 0);
            pdCtx.closePath();
          }
          if (useGradient) {
            const grad = isPortrait
              ? pdCtx.createLinearGradient(0, H*0.35, 0, H*0.58)
              : pdCtx.createLinearGradient(W*0.30, 0, W*0.54, 0);
            grad.addColorStop(0, shapeColor);
            grad.addColorStop(1, shapeColor2);
            pdCtx.fillStyle = grad;
          } else {
            pdCtx.fillStyle = shapeColor;
          }
          pdCtx.fill();
          pdCtx.restore();

          // Thin accent line right along the outer edge of that ribbon
          pdCtx.save();
          pdCtx.strokeStyle = accentColor;
          pdCtx.lineWidth = 5;
          pdCtx.beginPath();
          if (isPortrait) {
            const splitY = H * 0.46;
            pdCtx.moveTo(0, splitY - bandHalf);
            pdCtx.bezierCurveTo(W*0.35, splitY - H*0.07 - bandHalf, W*0.65, splitY + H*0.07 - bandHalf, W, splitY - bandHalf);
          } else {
            const splitX = W * 0.42;
            pdCtx.moveTo(splitX - bandHalf, 0);
            pdCtx.bezierCurveTo(splitX - W*0.06 - bandHalf, H*0.35, splitX + W*0.06 - bandHalf, H*0.65, splitX - bandHalf, H);
          }
          pdCtx.stroke();
          pdCtx.restore();

          // Text / logo panel
          pdCtx.textAlign = 'center';
          if (textMode === 'logo' && pdOwnLogoImage) {
            const logoSizeMult = (parseInt(el('mq-pd-logo-size')?.value,10)||100)/100;
            const maxLogoW = (isPortrait ? W*0.55 : W*0.30) * logoSizeMult;
            const maxLogoH = (isPortrait ? H*0.30 : H*0.5) * logoSizeMult;
            const logoRatio = pdOwnLogoImage.width / pdOwnLogoImage.height;
            let lw = maxLogoW, lh = lw / logoRatio;
            if (lh > maxLogoH) { lh = maxLogoH; lw = lh * logoRatio; }
            const lx = isPortrait ? (W - lw)/2 : (W*0.42 - lw)/2 - W*0.02;
            const ly = isPortrait ? (H*0.46 - lh)/2 + H*0.02 : (H - lh)/2;
            pdCtx.drawImage(pdOwnLogoImage, lx, ly, lw, lh);
          } else if (textMode === 'logo') {
            pdCtx.fillStyle = '#9ca3af';
            pdCtx.font = '500 32px -apple-system, sans-serif';
            pdCtx.fillText('Upload a logo above', isPortrait ? W/2 : W*0.21, isPortrait ? H*0.24 : H*0.5);
          } else {
            pdSetTextShadow();
            const preFont = `500 ${Math.round((isPortrait?38:34)*tc.preMult)}px Georgia, serif`;
            const nameFont = `800 ${Math.round((isPortrait?76:64)*tc.nameMult)}px -apple-system, sans-serif`;
            const tagFont = `500 ${Math.round((isPortrait?32:28)*tc.tagMult)}px -apple-system, sans-serif`;
            const centerX = isPortrait ? W/2 : W*0.21;
            let cy = (isPortrait ? H*0.12 : H*0.26) + tc.offsetPct * H;

            pdCtx.font = preFont;
            pdCtx.fillStyle = tc.preColor;
            pdCtx.fillText(tc.preText, centerX, cy);
            // Deliberately generous gap here — this was the "too congested"
            // spot, sitting right between the small intro line and the big
            // shop name below it.
            cy += (isPortrait ? 130 : 110) * tc.lineMult;

            pdCtx.font = nameFont;
            pdCtx.fillStyle = shapeColor;
            const nameLines = pdWrapText(pdShopName, nameFont, isPortrait ? W*0.85 : W*0.36);
            nameLines.forEach(line => { pdCtx.fillText(line, centerX, cy); cy += (isPortrait?86:72) * tc.lineMult; });

            if (tagline) {
              cy += (isPortrait ? 34 : 24) * tc.lineMult;
              pdCtx.font = tagFont;
              pdCtx.fillStyle = tc.tagColor;
              const tagLines = pdWrapText(tagline, tagFont, isPortrait ? W*0.8 : W*0.34);
              tagLines.forEach(line => { pdCtx.fillText(line, centerX, cy); cy += (isPortrait?48:42) * tc.lineMult; });
            }
          }

          // Optional QR code + "Get a Free Quote" button, centered in the
          // photo area — both independently toggleable, off by default.
          pdClearShadow();
          const qb = pdGetQrButtonSettings();
          const photoCx = isPortrait ? W/2 : W*0.28 + (W*0.75)/2;
          const photoCy = isPortrait ? H*0.32 + (H*0.74)/2 : H/2;
          if (qb.qrEnabled) {
            pdDrawQrCode(photoCx, photoCy + qb.qrOffsetPct * H, 260 * qb.qrSizeMult);
          }
          if (qb.btnEnabled) {
            pdDrawGetQuoteButton(photoCx, (isPortrait ? H*0.32 + H*0.74 : H) - 90 + qb.btnOffsetPct * H, shapeColor);
          }
        }

        function drawDiamondArrow() {
          const W = pdCanvas.width, H = pdCanvas.height;
          pdCtx.clearRect(0, 0, W, H);
          const isPortrait = pdOrientation === 'portrait';
          const textMode = el('mq-pd-text-mode')?.value || 'text';
          const tagline = el('mq-pd-tagline')?.value || '';
          const shapeColor = el('mq-pd-shape-color')?.value || '#1a3a6b';
          const useGradient = el('mq-pd-shape-gradient')?.checked || false;
          const accentColor = el('mq-pd-accent-color')?.value || '#c9a24b';
          const accentColor2 = el('mq-pd-shape-color2')?.value || pdShade(accentColor, -35);
          const bgColor = el('mq-pd-bg-color')?.value || '#111111';
          const bgColor2 = el('mq-pd-bg-color2')?.value || pdShade(bgColor, -25);
          const bgGradient = el('mq-pd-bg-gradient')?.checked || false;
          const tc = pdGetTextControls();

          pdFillBackground(W, H, bgColor, bgColor2, bgGradient);

          // Photo zone, clipped to an angular arrow-point boundary instead
          // of a curve.
          pdCtx.save();
          pdCtx.beginPath();
          if (isPortrait) {
            const splitY = H * 0.46, pointDepth = H * 0.05;
            pdCtx.moveTo(0, splitY + pointDepth);
            pdCtx.lineTo(W*0.5, splitY - pointDepth);
            pdCtx.lineTo(W, splitY + pointDepth);
            pdCtx.lineTo(W, H); pdCtx.lineTo(0, H); pdCtx.closePath();
          } else {
            const splitX = W * 0.44, pointDepth = W * 0.05;
            pdCtx.moveTo(splitX + pointDepth, 0);
            pdCtx.lineTo(splitX - pointDepth, H*0.5);
            pdCtx.lineTo(splitX + pointDepth, H);
            pdCtx.lineTo(W, H); pdCtx.lineTo(W, 0); pdCtx.closePath();
          }
          pdCtx.clip();
          if (isPortrait) pdDrawPhotoInRect(pdPhotoImage, 0, H*0.32, W, H*0.74);
          else pdDrawPhotoInRect(pdPhotoImage, W*0.30, 0, W*0.75, H);
          pdCtx.restore();

          // Coloured accent stripe right along the point, plus a second
          // thinner line for depth — the customizable "shape" element here.
          pdCtx.save();
          pdCtx.beginPath();
          if (isPortrait) {
            const splitY = H * 0.46, pointDepth = H * 0.05, stripeW = H*0.012;
            pdCtx.moveTo(0, splitY + pointDepth - stripeW);
            pdCtx.lineTo(W*0.5, splitY - pointDepth - stripeW);
            pdCtx.lineTo(W, splitY + pointDepth - stripeW);
            pdCtx.lineTo(W, splitY + pointDepth + stripeW);
            pdCtx.lineTo(W*0.5, splitY - pointDepth + stripeW);
            pdCtx.lineTo(0, splitY + pointDepth + stripeW);
            pdCtx.closePath();
          } else {
            const splitX = W * 0.44, pointDepth = W * 0.05, stripeW = W*0.009;
            pdCtx.moveTo(splitX + pointDepth - stripeW, 0);
            pdCtx.lineTo(splitX - pointDepth - stripeW, H*0.5);
            pdCtx.lineTo(splitX + pointDepth - stripeW, H);
            pdCtx.lineTo(splitX + pointDepth + stripeW, H);
            pdCtx.lineTo(splitX - pointDepth + stripeW, H*0.5);
            pdCtx.lineTo(splitX + pointDepth + stripeW, 0);
            pdCtx.closePath();
          }
          if (useGradient) {
            const grad = isPortrait
              ? pdCtx.createLinearGradient(0, H*0.35, 0, H*0.58)
              : pdCtx.createLinearGradient(W*0.34, 0, W*0.56, 0);
            grad.addColorStop(0, accentColor);
            grad.addColorStop(1, accentColor2);
            pdCtx.fillStyle = grad;
          } else {
            pdCtx.fillStyle = accentColor;
          }
          pdCtx.fill();
          pdCtx.restore();

          // Text / logo panel
          pdCtx.textAlign = 'center';
          if (textMode === 'logo' && pdOwnLogoImage) {
            const logoSizeMult = (parseInt(el('mq-pd-logo-size')?.value,10)||100)/100;
            const maxLogoW = (isPortrait ? W*0.55 : W*0.30) * logoSizeMult;
            const maxLogoH = (isPortrait ? H*0.30 : H*0.5) * logoSizeMult;
            const logoRatio = pdOwnLogoImage.width / pdOwnLogoImage.height;
            let lw = maxLogoW, lh = lw / logoRatio;
            if (lh > maxLogoH) { lh = maxLogoH; lw = lh * logoRatio; }
            const lx = isPortrait ? (W - lw)/2 : (W*0.44 - lw)/2;
            const ly = isPortrait ? (H*0.46 - lh)/2 : (H - lh)/2;
            pdCtx.drawImage(pdOwnLogoImage, lx, ly, lw, lh);
          } else if (textMode === 'logo') {
            pdCtx.fillStyle = '#6b6b6b';
            pdCtx.font = '500 32px -apple-system, sans-serif';
            pdCtx.fillText('Upload a logo above', isPortrait ? W/2 : W*0.22, isPortrait ? H*0.24 : H*0.5);
          } else {
            pdSetTextShadow();
            const preFont = `italic 500 ${Math.round((isPortrait?38:34)*tc.preMult)}px Georgia, serif`;
            const nameFont = `800 ${Math.round((isPortrait?72:60)*tc.nameMult)}px -apple-system, sans-serif`;
            const tagFont = `500 ${Math.round((isPortrait?32:28)*tc.tagMult)}px -apple-system, sans-serif`;
            const centerX = isPortrait ? W/2 : W*0.22;
            let cy = (isPortrait ? H*0.12 : H*0.26) + tc.offsetPct * H;

            pdCtx.font = preFont;
            pdCtx.fillStyle = tc.preColor;
            pdCtx.fillText(tc.preText, centerX, cy);
            cy += (isPortrait ? 130 : 110) * tc.lineMult;

            pdCtx.font = nameFont;
            pdCtx.fillStyle = shapeColor;
            const nameLines = pdWrapText(pdShopName, nameFont, isPortrait ? W*0.85 : W*0.38);
            nameLines.forEach(line => { pdCtx.fillText(line, centerX, cy); cy += (isPortrait?82:68) * tc.lineMult; });

            if (tagline) {
              cy += (isPortrait ? 34 : 24) * tc.lineMult;
              pdCtx.font = tagFont;
              pdCtx.fillStyle = tc.tagColor;
              const tagLines = pdWrapText(tagline, tagFont, isPortrait ? W*0.8 : W*0.36);
              tagLines.forEach(line => { pdCtx.fillText(line, centerX, cy); cy += (isPortrait?48:42) * tc.lineMult; });
            }
          }

          pdClearShadow();
          const qb = pdGetQrButtonSettings();
          const photoCx = isPortrait ? W/2 : W*0.30 + (W*0.75)/2;
          const photoCy = isPortrait ? H*0.32 + (H*0.74)/2 : H/2;
          if (qb.qrEnabled) {
            pdDrawQrCode(photoCx, photoCy + qb.qrOffsetPct * H, 260 * qb.qrSizeMult);
          }
          if (qb.btnEnabled) {
            pdDrawGetQuoteButton(photoCx, (isPortrait ? H*0.32 + H*0.74 : H) - 90 + qb.btnOffsetPct * H, shapeColor);
          }
        }

        function drawOrnateDivider() {
          const W = pdCanvas.width, H = pdCanvas.height;
          pdCtx.clearRect(0, 0, W, H);
          const isPortrait = pdOrientation === 'portrait';
          const textMode = el('mq-pd-text-mode')?.value || 'text';
          const tagline = el('mq-pd-tagline')?.value || '';
          const shapeColor = el('mq-pd-shape-color')?.value || '#8a5a3a';
          const accentColor = el('mq-pd-accent-color')?.value || '#8a5a3a';
          const bgColor = el('mq-pd-bg-color')?.value || '#ffffff';
          const bgColor2 = el('mq-pd-bg-color2')?.value || pdShade(bgColor, -20);
          const bgGradient = el('mq-pd-bg-gradient')?.checked || false;
          const tc = pdGetTextControls();

          pdFillBackground(W, H, bgColor, bgColor2, bgGradient);

          // Photo sits in a simple rounded panel, not a curve/angle — this
          // template's character comes from the ornate line-and-diamond
          // dividers around the text instead of the shape boundary itself.
          const photoY = isPortrait ? H*0.50 : 0;
          const photoX = isPortrait ? 0 : W*0.48;
          const photoW = isPortrait ? W : W*0.52;
          const photoH = isPortrait ? H*0.50 : H;
          pdCtx.save();
          pdCtx.beginPath();
          pdCtx.rect(photoX, photoY, photoW, photoH);
          pdCtx.clip();
          pdDrawPhotoInRect(pdPhotoImage, photoX, photoY, photoW, photoH);
          pdCtx.restore();

          pdCtx.textAlign = 'center';
          const centerX = isPortrait ? W/2 : W*0.24;
          const textTop = isPortrait ? H*0.10 : H*0.14;
          const dividerW = isPortrait ? W*0.28 : W*0.16;

          function ornateDivider(y) {
            pdCtx.strokeStyle = accentColor;
            pdCtx.lineWidth = 3;
            pdCtx.beginPath();
            pdCtx.moveTo(centerX - dividerW, y); pdCtx.lineTo(centerX - 14, y);
            pdCtx.moveTo(centerX + 14, y); pdCtx.lineTo(centerX + dividerW, y);
            pdCtx.stroke();
            pdCtx.save();
            pdCtx.translate(centerX, y);
            pdCtx.rotate(Math.PI/4);
            pdCtx.fillStyle = accentColor;
            pdCtx.fillRect(-7, -7, 14, 14);
            pdCtx.restore();
          }

          if (textMode === 'logo' && pdOwnLogoImage) {
            const logoSizeMult = (parseInt(el('mq-pd-logo-size')?.value,10)||100)/100;
            const maxLogoW = (isPortrait ? W*0.55 : W*0.34) * logoSizeMult, maxLogoH = (isPortrait ? H*0.32 : H*0.5) * logoSizeMult;
            const ratio = pdOwnLogoImage.width / pdOwnLogoImage.height;
            let lw = maxLogoW, lh = lw/ratio;
            if (lh > maxLogoH) { lh = maxLogoH; lw = lh*ratio; }
            pdCtx.drawImage(pdOwnLogoImage, centerX - lw/2, textTop, lw, lh);
          } else if (textMode === 'logo') {
            pdCtx.fillStyle = '#9ca3af';
            pdCtx.font = '500 30px -apple-system, sans-serif';
            pdCtx.fillText('Upload a logo above', centerX, textTop + 40);
          } else {
            pdSetTextShadow();
            const preFont = `500 ${Math.round((isPortrait?34:30)*tc.preMult)}px -apple-system, sans-serif`;
            const nameFont = `700 ${Math.round((isPortrait?66:54)*tc.nameMult)}px Georgia, serif`;
            const tagFont = `500 ${Math.round((isPortrait?28:24)*tc.tagMult)}px -apple-system, sans-serif`;
            let cy = textTop + tc.offsetPct * H;

            ornateDivider(cy); cy += (isPortrait ? 60 : 50) * tc.lineMult;
            pdCtx.font = preFont; pdCtx.fillStyle = tc.preColor;
            pdCtx.fillText(tc.preText, centerX, cy); cy += (isPortrait ? 90 : 76) * tc.lineMult;

            pdCtx.font = nameFont; pdCtx.fillStyle = shapeColor;
            const nameLines = pdWrapText(pdShopName, nameFont, isPortrait ? W*0.82 : W*0.36);
            nameLines.forEach(l => { pdCtx.fillText(l, centerX, cy); cy += (isPortrait?74:62) * tc.lineMult; });
            cy += (isPortrait ? 20 : 14) * tc.lineMult;
            ornateDivider(cy); cy += (isPortrait ? 50 : 42) * tc.lineMult;

            if (tagline) {
              pdCtx.font = tagFont; pdCtx.fillStyle = tc.tagColor;
              pdWrapText(tagline, tagFont, isPortrait ? W*0.75 : W*0.32).forEach(l => { pdCtx.fillText(l, centerX, cy); cy += (isPortrait?44:38) * tc.lineMult; });
            }
          }

          pdClearShadow();
          const qb = pdGetQrButtonSettings();
          const photoCx = photoX + photoW/2, photoCy = photoY + photoH/2;
          if (qb.qrEnabled) {
            pdDrawQrCode(photoCx, photoCy + qb.qrOffsetPct * H, 240 * qb.qrSizeMult);
          }
          if (qb.btnEnabled) {
            pdDrawGetQuoteButton(photoCx, photoY + photoH - 90 + qb.btnOffsetPct * H, shapeColor);
          }
        }

        function drawCircularBadge() {
          const W = pdCanvas.width, H = pdCanvas.height;
          pdCtx.clearRect(0, 0, W, H);
          const textMode = el('mq-pd-text-mode')?.value || 'text';
          const tagline = el('mq-pd-tagline')?.value || '';
          const badgeText = (el('mq-pd-badge-text')?.value || '').trim();
          const shapeColor = el('mq-pd-shape-color')?.value || '#c9a24b';
          const shapeColor2 = el('mq-pd-shape-color2')?.value || pdShade(shapeColor, -30);
          const useGradient = el('mq-pd-shape-gradient')?.checked || false;
          const bgColor = el('mq-pd-bg-color')?.value || '#1a1a1a';
          const tc = pdGetTextControls();

          // Photo fills the whole canvas here, darkened for legibility —
          // the badge and text sit right on top of it.
          pdDrawPhotoInRect(pdPhotoImage, 0, 0, W, H);
          pdCtx.globalAlpha = 0.55;
          pdCtx.fillStyle = bgColor;
          pdCtx.fillRect(0, 0, W, H);
          pdCtx.globalAlpha = 1;

          const cx = W/2, cy = H*0.42, r = Math.min(W,H) * 0.20;
          pdCtx.save();
          pdCtx.beginPath();
          pdCtx.arc(cx, cy, r, 0, Math.PI*2);
          pdCtx.clip();
          if (textMode === 'logo' && pdOwnLogoImage) {
            pdDrawPhotoInRect(pdOwnLogoImage, cx-r, cy-r, r*2, r*2);
          } else {
            pdCtx.fillStyle = '#1a1a1a';
            pdCtx.fillRect(cx-r, cy-r, r*2, r*2);
            pdCtx.fillStyle = shapeColor;
            // Badge text is independent of the shop name — type anything
            // (initials, a symbol, whatever) via the "Badge text" field
            // above, or leave it blank to fall back to auto-initials.
            const displayText = badgeText || (pdShopName.match(/\b\w/g) || ['D']).slice(0,2).join('').toUpperCase();
            pdCtx.font = `800 ${Math.round(r*0.9*tc.nameMult)}px -apple-system, sans-serif`;
            pdCtx.textAlign = 'center'; pdCtx.textBaseline = 'middle';
            pdCtx.fillText(displayText, cx, cy + r*0.08);
            pdCtx.textBaseline = 'alphabetic';
          }
          pdCtx.restore();

          pdCtx.save();
          pdCtx.beginPath();
          pdCtx.arc(cx, cy, r, 0, Math.PI*2);
          pdCtx.lineWidth = 6;
          if (useGradient) {
            const g = pdCtx.createLinearGradient(cx-r, cy-r, cx+r, cy+r);
            g.addColorStop(0, shapeColor); g.addColorStop(1, shapeColor2);
            pdCtx.strokeStyle = g;
          } else pdCtx.strokeStyle = shapeColor;
          pdCtx.stroke();
          pdCtx.restore();

          pdCtx.textAlign = 'center';
          pdSetTextShadow();
          const preFont = `500 ${Math.round(30*tc.preMult)}px -apple-system, sans-serif`;
          const nameFont = `800 ${Math.round(52*tc.nameMult)}px -apple-system, sans-serif`;
          const tagFont = `500 ${Math.round(24*tc.tagMult)}px -apple-system, sans-serif`;
          let ty = cy + r + 70 + tc.offsetPct * H;
          pdCtx.font = preFont; pdCtx.fillStyle = tc.preColor;
          pdCtx.fillText(tc.preText, cx, ty); ty += 58 * tc.lineMult;
          pdCtx.font = nameFont; pdCtx.fillStyle = '#ffffff';
          pdWrapText(pdShopName, nameFont, W*0.85).forEach(l => { pdCtx.fillText(l, cx, ty); ty += 58 * tc.lineMult; });
          if (tagline) {
            ty += 14 * tc.lineMult;
            pdCtx.font = tagFont; pdCtx.fillStyle = tc.tagColor;
            pdWrapText(tagline, tagFont, W*0.8).forEach(l => { pdCtx.fillText(l, cx, ty); ty += 38 * tc.lineMult; });
          }

          pdClearShadow();
          const qb = pdGetQrButtonSettings();
          if (qb.qrEnabled) {
            pdDrawQrCode(cx, ty + 130 + qb.qrOffsetPct * H, 220 * qb.qrSizeMult);
          }
          if (qb.btnEnabled) {
            pdDrawGetQuoteButton(cx, H - 90 + qb.btnOffsetPct * H, shapeColor);
          }
        }

        function drawBoldModern() {
          const W = pdCanvas.width, H = pdCanvas.height;
          pdCtx.clearRect(0, 0, W, H);
          const isPortrait = pdOrientation === 'portrait';
          const textMode = el('mq-pd-text-mode')?.value || 'text';
          const tagline = el('mq-pd-tagline')?.value || '';
          const shapeColor = el('mq-pd-shape-color')?.value || '#1a3a6b';
          const shapeColor2 = el('mq-pd-shape-color2')?.value || pdShade(shapeColor, -35);
          const useGradient = el('mq-pd-shape-gradient')?.checked || false;
          const accentColor = el('mq-pd-accent-color')?.value || '#c9a24b';
          const tc = pdGetTextControls();

          // A hard, flat rectangular split — no curve or angle at all. This
          // template's identity is bold, uncluttered geometry instead.
          const splitAt = isPortrait ? H*0.58 : W*0.46;
          if (useGradient) {
            const g = isPortrait ? pdCtx.createLinearGradient(0,0,0,splitAt) : pdCtx.createLinearGradient(0,0,splitAt,0);
            g.addColorStop(0, shapeColor); g.addColorStop(1, shapeColor2);
            pdCtx.fillStyle = g;
          } else pdCtx.fillStyle = shapeColor;
          if (isPortrait) pdCtx.fillRect(0, 0, W, splitAt); else pdCtx.fillRect(0, 0, splitAt, H);

          // Clip the photo to its own half of the canvas before drawing —
          // pdDrawPhotoInRect deliberately overflows to "cover" its target
          // box (same idea as CSS background-size:cover), which every other
          // template already contains with its own clip path. This was the
          // one template drawing the photo with no clip at all, so that
          // intentional overflow was free to bleed straight into the
          // colour panel next to it.
          pdCtx.save();
          pdCtx.beginPath();
          if (isPortrait) pdCtx.rect(0, splitAt, W, H - splitAt);
          else pdCtx.rect(splitAt, 0, W - splitAt, H);
          pdCtx.clip();
          if (isPortrait) pdDrawPhotoInRect(pdPhotoImage, 0, splitAt, W, H - splitAt);
          else pdDrawPhotoInRect(pdPhotoImage, splitAt, 0, W - splitAt, H);
          pdCtx.restore();

          pdCtx.fillStyle = accentColor;
          if (isPortrait) pdCtx.fillRect(0, splitAt - 3, W, 6); else pdCtx.fillRect(splitAt - 3, 0, 6, H);

          pdCtx.textAlign = 'center';
          const centerX = isPortrait ? W/2 : W*0.20;
          const textColor = pdMutedTextColorFor(shapeColor) === '#5b5b5b' ? '#1a1a1a' : '#ffffff';
          const mutedColor = textColor === '#ffffff' ? '#d0d0d0' : '#555555';

          if (textMode === 'logo' && pdOwnLogoImage) {
            const logoSizeMult = (parseInt(el('mq-pd-logo-size')?.value,10)||100)/100;
            const maxLogoW = (isPortrait ? W*0.55 : splitAt*0.75) * logoSizeMult, maxLogoH = (isPortrait ? splitAt*0.6 : H*0.5) * logoSizeMult;
            const ratio = pdOwnLogoImage.width / pdOwnLogoImage.height;
            let lw = maxLogoW, lh = lw/ratio;
            if (lh > maxLogoH) { lh = maxLogoH; lw = lh*ratio; }
            pdCtx.drawImage(pdOwnLogoImage, centerX-lw/2, (isPortrait?splitAt:H)/2 - lh/2, lw, lh);
          } else if (textMode === 'logo') {
            pdCtx.fillStyle = mutedColor;
            pdCtx.font = '500 28px -apple-system, sans-serif';
            pdCtx.fillText('Upload a logo above', centerX, isPortrait ? splitAt/2 : H/2);
          } else {
            pdSetTextShadow();
            const preFont = `700 ${Math.round((isPortrait?32:28)*tc.preMult)}px -apple-system, sans-serif`;
            const nameFont = `900 ${Math.round((isPortrait?70:56)*tc.nameMult)}px -apple-system, sans-serif`;
            const tagFont = `500 ${Math.round((isPortrait?28:24)*tc.tagMult)}px -apple-system, sans-serif`;
            let cy = (isPortrait ? splitAt*0.26 : H*0.30) + tc.offsetPct * H;
            pdCtx.font = preFont; pdCtx.fillStyle = tc.preColor;
            pdCtx.fillText(tc.preText.toUpperCase(), centerX, cy); cy += (isPortrait?66:56) * tc.lineMult;
            pdCtx.font = nameFont; pdCtx.fillStyle = textColor;
            pdWrapText(pdShopName, nameFont, isPortrait ? W*0.85 : splitAt*0.85).forEach(l => { pdCtx.fillText(l, centerX, cy); cy += (isPortrait?76:64) * tc.lineMult; });
            if (tagline) {
              cy += (isPortrait ? 20 : 14) * tc.lineMult;
              pdCtx.font = tagFont; pdCtx.fillStyle = tc.tagColor;
              pdWrapText(tagline, tagFont, isPortrait ? W*0.8 : splitAt*0.8).forEach(l => { pdCtx.fillText(l, centerX, cy); cy += (isPortrait?42:38) * tc.lineMult; });
            }
          }

          pdClearShadow();
          const qb = pdGetQrButtonSettings();
          const photoCx = isPortrait ? W/2 : splitAt + (W-splitAt)/2;
          const photoCy = isPortrait ? splitAt + (H-splitAt)/2 : H/2;
          if (qb.qrEnabled) {
            pdDrawQrCode(photoCx, photoCy + qb.qrOffsetPct * H, 250 * qb.qrSizeMult);
          }
          if (qb.btnEnabled) {
            pdDrawGetQuoteButton(photoCx, H - 90 + qb.btnOffsetPct * H, shapeColor);
          }
        }

        function drawPosterDesigner() {
          if (pdTemplate === 'diamond-arrow') drawDiamondArrow();
          else if (pdTemplate === 'ornate-divider') drawOrnateDivider();
          else if (pdTemplate === 'circular-badge') drawCircularBadge();
          else if (pdTemplate === 'bold-modern') drawBoldModern();
          else drawCurvedSplit();
        }
        window._mqRedrawPosterDesigner = drawPosterDesigner;

        window.mqPdSelectTemplate = (tpl, thumbEl) => {
          pdTemplate = tpl;
          document.querySelectorAll('.mq-pd-template-thumb').forEach(t => t.style.border = '2px solid #e5e7eb');
          if (thumbEl) thumbEl.style.border = '2px solid #1a1a1a';
          // A sensible starting background per style — still fully editable
          // afterward, this just saves someone from starting on a white
          // background for a template designed to look best dark, or vice versa.
          const bgInput = el('mq-pd-bg-color');
          const bgInput2 = el('mq-pd-bg-color2');
          const shapeInput = el('mq-pd-shape-color');
          const shapeInput2 = el('mq-pd-shape-color2');
          const accentInput = el('mq-pd-accent-color');
          if (bgInput) {
            if (tpl === 'diamond-arrow' || tpl === 'circular-badge') bgInput.value = '#111111';
            else bgInput.value = '#ffffff';
          }
          // A second colour for whichever gradient checkbox someone turns
          // on — chosen to actually look like a deliberate two-tone blend
          // for this specific style, not just a random pairing.
          if (bgInput2) {
            if (tpl === 'diamond-arrow' || tpl === 'circular-badge') bgInput2.value = '#2b2b2b';
            else bgInput2.value = '#f0f0f0';
          }
          if (shapeInput && accentInput) {
            if (tpl === 'diamond-arrow') { shapeInput.value = '#c9a24b'; accentInput.value = '#c9a24b'; }
            else if (tpl === 'ornate-divider') { shapeInput.value = '#6b4226'; accentInput.value = '#8a5a3a'; }
            else if (tpl === 'circular-badge') { shapeInput.value = '#c9a24b'; accentInput.value = '#c9a24b'; }
            else if (tpl === 'bold-modern') { shapeInput.value = '#1a3a6b'; accentInput.value = '#c9a24b'; }
            else { shapeInput.value = '#1a3a6b'; accentInput.value = '#c9a24b'; }
          }
          if (shapeInput2) {
            if (tpl === 'diamond-arrow') shapeInput2.value = '#8a6d2b';
            else if (tpl === 'ornate-divider') shapeInput2.value = '#3d2814';
            else if (tpl === 'circular-badge') shapeInput2.value = '#8a6d2b';
            else if (tpl === 'bold-modern') shapeInput2.value = '#378ADD';
            else shapeInput2.value = '#378ADD';
          }
          // Same idea for the pre-line/tagline text colours — sensible
          // per-style defaults for readability, still fully editable.
          const preColorInput = el('mq-pd-pre-color');
          const tagColorInput = el('mq-pd-tag-color');
          if (preColorInput && tagColorInput) {
            if (tpl === 'diamond-arrow') { preColorInput.value = '#e5e7eb'; tagColorInput.value = '#e5e7eb'; }
            else if (tpl === 'circular-badge') { preColorInput.value = '#f0f0f0'; tagColorInput.value = '#e0e0e0'; }
            else if (tpl === 'bold-modern') { preColorInput.value = '#d0d0d0'; tagColorInput.value = '#d0d0d0'; }
            else { preColorInput.value = '#6b6b6b'; tagColorInput.value = '#4b4b4b'; }
          }
          drawPosterDesigner();
        };

        window.mqPdSetOrientation = (orient) => {
          pdOrientation = orient;
          if (orient === 'portrait') { pdCanvas.width = 1080; pdCanvas.height = 1620; }
          else { pdCanvas.width = 1620; pdCanvas.height = 1080; }
          pdCanvas.style.width = 'auto';
          pdCanvas.style.height = '300px'; // fixed height so landscape ends up wider, not shorter, matching portrait's actual visual size
          drawPosterDesigner();
        };

        window.mqPdBtnToggled = () => {
          const wrap = el('mq-pd-btn-controls-wrap');
          const enabled = el('mq-pd-btn-enabled')?.checked;
          if (wrap) wrap.style.display = enabled ? 'block' : 'none';
          drawPosterDesigner();
        };

        window.mqPdQrToggled = () => {
          const wrap = el('mq-pd-qr-controls-wrap');
          const enabled = el('mq-pd-qr-enabled')?.checked;
          if (wrap) wrap.style.display = enabled ? 'block' : 'none';
          drawPosterDesigner();
        };

        window.mqPdToggleGradientColor2 = (wrapId, show) => {
          const wrap = document.getElementById(wrapId);
          if (wrap) wrap.style.display = show ? 'inline-block' : 'none';
          drawPosterDesigner();
        };

        window.mqPdTextModeChanged = () => {
          const mode = el('mq-pd-text-mode')?.value;
          const wrap = el('mq-pd-logo-upload-wrap');
          if (wrap) wrap.style.display = mode === 'logo' ? 'block' : 'none';
          drawPosterDesigner();
        };

        const pdPhotoInput = el('mq-pd-photo-input');
        if (pdPhotoInput) {
          pdPhotoInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => { pdPhotoImage = img; drawPosterDesigner(); };
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          };
        }

        const pdLogoInput = el('mq-pd-logo-input');
        if (pdLogoInput) {
          pdLogoInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => { pdOwnLogoImage = img; drawPosterDesigner(); };
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          };
        }

        const pdBgImageInput = el('mq-pd-bg-image-input');
        if (pdBgImageInput) {
          pdBgImageInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => { pdBgImage = img; drawPosterDesigner(); };
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          };
        }

        // Tap-to-zoom — converts the current canvas to an image and shows it
        // full-screen, since a canvas itself can't be pinch-zoomed the way a
        // real <img> can. Tap anywhere to close.
        window.mqPdOpenZoom = () => {
          let overlay = document.getElementById('mq-pd-zoom-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mq-pd-zoom-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
            overlay.onclick = () => { overlay.style.display = 'none'; };
            document.body.appendChild(overlay);
          }
          overlay.innerHTML = `<img src="${pdCanvas.toDataURL('image/png')}" style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.4)"/>`;
          overlay.style.display = 'flex';
        };

        window.mqPdToggleColorSection = () => {
          const body = el('mq-pd-color-section-body');
          const arrow = el('mq-pd-color-section-arrow');
          if (!body) return;
          const opening = body.style.display === 'none';
          body.style.display = opening ? 'block' : 'none';
          if (arrow) arrow.style.transform = opening ? 'rotate(0deg)' : 'rotate(-90deg)';
        };

        // Pulls a live directory listing from the GitHub repo's textures
        // folder via GitHub's API — no filenames hardcoded anywhere, so
        // whatever gets added or removed from that folder just works, no
        // code changes needed on our end. Cached per page load so flipping
        // the picker open and closed doesn't keep re-fetching.
        let _pdTextureCache = null;
        window.mqPdLoadTextureLibrary = async () => {
          const grid = el('mq-pd-texture-grid');
          if (!grid) return;
          const showing = grid.style.display === 'grid';
          if (showing) { grid.style.display = 'none'; return; }
          grid.style.display = 'grid';
          if (_pdTextureCache) {
            renderTextureGrid(_pdTextureCache);
            return;
          }
          grid.innerHTML = '<div style="grid-column:1/-1;font-size:11px;color:#9ca3af;padding:6px">Loading textures…</div>';
          try {
            const res = await fetch('https://api.github.com/repos/aceswin/midasquote-widget/contents/textures');
            if (!res.ok) throw new Error('Could not load texture list');
            const files = await res.json();
            const images = (Array.isArray(files) ? files : [])
              .filter(f => f.type === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(f.name))
              .map(f => ({ name: f.name, url: `https://widget.midasquote.com/textures/${encodeURIComponent(f.name)}` }));
            _pdTextureCache = images;
            renderTextureGrid(images);
          } catch(e) {
            grid.innerHTML = '<div style="grid-column:1/-1;font-size:11px;color:#dc2626;padding:6px">Couldn\'t load the texture library — try again in a moment.</div>';
          }
          function renderTextureGrid(images) {
            if (!images.length) {
              grid.innerHTML = '<div style="grid-column:1/-1;font-size:11px;color:#9ca3af;padding:6px">No textures found yet.</div>';
              return;
            }
            grid.innerHTML = images.map(img => `
              <div onclick="mqPdSelectTexture('${img.url.replace(/'/g,"\\'")}')" style="cursor:pointer;border:2px solid #e5e7eb;border-radius:6px;overflow:hidden;aspect-ratio:1;background:#f3f4f6" title="${img.name.replace(/"/g,'&quot;')}">
                <img src="${img.url}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy"/>
              </div>
            `).join('');
          }
        };

        window.mqPdSelectTexture = (url) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { pdBgImage = img; drawPosterDesigner(); };
          img.onerror = () => { alert("Couldn't load that texture — try a different one."); };
          img.src = url;
        };

        window.mqPdBgImageToggled = () => {
          const wrap = el('mq-pd-bg-image-upload-wrap');
          const enabled = el('mq-pd-bg-image-enabled')?.checked;
          if (wrap) wrap.style.display = enabled ? 'block' : 'none';
          drawPosterDesigner();
        };

        const pdDownloadBtn = el('mq-pd-download-btn');
        if (pdDownloadBtn) {
          pdDownloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.download = (pdShopName.replace(/[^a-z0-9]/gi,'-').toLowerCase() || 'poster') + '-' + pdTemplate + '-' + pdOrientation + '.png';
            link.href = pdCanvas.toDataURL('image/png');
            link.click();
          };
        }

        drawPosterDesigner();

        // Only show the floating preview while this specific section is
        // BOTH scrolled into view AND actually expanded — not just
        // scrolled past while collapsed, and not the whole time someone's
        // anywhere on the Marketing Kit page.
        const pdOuterCard = document.getElementById('mq-pd-outer-card');
        const pdStickyPreview = document.getElementById('mq-pd-sticky-preview');
        let pdSectionInView = false;
        window._mqPdUpdateStickyVisibility = () => {
          if (!pdStickyPreview) return;
          const body = document.getElementById('mq-mk-body-poster');
          const isOpen = body && body.style.display !== 'none';
          pdStickyPreview.style.display = (pdSectionInView && isOpen) ? 'block' : 'none';
        };
        if (pdOuterCard && pdStickyPreview && 'IntersectionObserver' in window) {
          const pdObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              pdSectionInView = entry.isIntersecting;
              window._mqPdUpdateStickyVisibility();
            });
          }, { threshold: 0.05 });
          pdObserver.observe(pdOuterCard);
        }
      }
  }

  // JS-driven sticky nav — CSS position:sticky silently stops working if ANY
  // ancestor element has overflow:hidden/auto/scroll set on it, which is very
  // common in page builders (Webflow, etc.) this dashboard gets embedded in.
  // This works regardless of the surrounding page's container structure,
  // since it just measures real scroll position rather than depending on
  // the CSS containing-block chain.
  function mqInitStickyNav() {
    const sidebar = document.querySelector('#midasquote-dashboard .mq-sidebar');
    const layout  = document.querySelector('#midasquote-dashboard .mq-layout');
    const topbar  = document.querySelector('#midasquote-dashboard .mq-topbar');
    if (!sidebar || !layout) return;

    // Holds the sidebar's normal-flow space open once it goes fixed, so the
    // content column doesn't jump sideways when the sidebar leaves the flex flow.
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    placeholder.style.flexShrink = '0';
    layout.insertBefore(placeholder, sidebar);

    let stuck = false;

    function update() {
      const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 60;
      const layoutRect = layout.getBoundingClientRect();
      const shouldStick = layoutRect.top <= topbarHeight && layoutRect.bottom > topbarHeight;

      if (shouldStick && !stuck) {
        const rect = sidebar.getBoundingClientRect();
        placeholder.style.width = rect.width + 'px';
        placeholder.style.height = rect.height + 'px';
        placeholder.style.display = 'block';
        sidebar.style.position = 'fixed';
        sidebar.style.top = topbarHeight + 'px';
        sidebar.style.left = layoutRect.left + 'px';
        sidebar.style.width = rect.width + 'px';
        sidebar.style.maxHeight = `calc(100vh - ${topbarHeight}px)`;
        sidebar.style.overflowY = 'auto';
        sidebar.style.zIndex = '90';
        stuck = true;
      } else if (!shouldStick && stuck) {
        sidebar.style.position = '';
        sidebar.style.top = '';
        sidebar.style.left = '';
        sidebar.style.width = '';
        sidebar.style.maxHeight = '';
        sidebar.style.overflowY = '';
        sidebar.style.zIndex = '';
        placeholder.style.display = 'none';
        stuck = false;
      } else if (stuck) {
        // Keep it aligned in case of resize/orientation change while stuck
        sidebar.style.left = layoutRect.left + 'px';
      }
    }

    let ticking = false;
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    update();
  }

  // Same technique as mqInitStickyNav, applied to the topbar — CSS
  // position:sticky was silently failing on both for the same reason.
  function mqInitStickyTopbar() {
    const topbar = document.querySelector('#midasquote-dashboard .mq-topbar');
    const root = document.getElementById('midasquote-dashboard');
    if (!topbar || !root) return;

    // Holds the topbar's normal-flow space open once it goes fixed, so
    // everything below it doesn't jump up to fill the gap.
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    root.insertBefore(placeholder, topbar);

    let stuck = false;

    function update() {
      const rootRect = root.getBoundingClientRect();
      const rect = topbar.getBoundingClientRect();
      const shouldStick = rootRect.top <= 0 && rootRect.bottom > rect.height;

      if (shouldStick && !stuck) {
        placeholder.style.width = rect.width + 'px';
        placeholder.style.height = rect.height + 'px';
        placeholder.style.display = 'block';
        topbar.style.position = 'fixed';
        topbar.style.top = '0px';
        topbar.style.left = rootRect.left + 'px';
        topbar.style.width = rect.width + 'px';
        topbar.style.zIndex = '100';
        stuck = true;
      } else if (!shouldStick && stuck) {
        topbar.style.position = '';
        topbar.style.top = '';
        topbar.style.left = '';
        topbar.style.width = '';
        topbar.style.zIndex = '';
        placeholder.style.display = 'none';
        stuck = false;
      } else if (stuck) {
        topbar.style.left = rootRect.left + 'px';
      }
    }

    let ticking = false;
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    update();
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
    let memberHasActivePlan = null;
    let memberStripeCustomerId = null;
    if (!shopToken && window.$memberstackDom) {
      try {
        const { data: member } = await window.$memberstackDom.getCurrentMember();
        if (member) {
          shopToken = member.metaData?.shoptoken || member.metaData?.shopToken || member.customFields?.shoptoken || member.customFields?.shopToken;
          const plans = member?.planConnections || [];
          memberHasActivePlan = plans.length > 0;
          memberStripeCustomerId = member.stripeCustomerId || member.customerId || plans[0]?.payment?.stripeCustomerId || null;
        }
      } catch(e) {}
    }
    if (!shopToken) {
      container.innerHTML = '<div style="padding:4rem;text-align:center;color:#dc2626;font-size:14px">Unable to load your dashboard — shop token not found. Please <a href="/login" style="color:#1a1a1a;font-weight:600">log in again</a> or contact support at support@midasquote.com</div>';
      return;
    }

    const shopRecord = await loadShop(shopToken);
    if (!shopRecord) {
      container.innerHTML = '<div class="mq-loading" style="padding:4rem;text-align:center;color:#dc2626">Shop not found. Please contact support at support@midasquote.com</div>';
      return;
    }

    window._mqShopRecord = shopRecord;

    if (!shopRecord.fields['Welcome popup seen']) {
      window.mqShowWelcomeModal();
    }

    // Save Stripe customer ID to Airtable if we have it and it's not stored yet
    if (memberStripeCustomerId && !shopRecord.fields['Stripe customer ID']) {
      try { await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Stripe customer ID': memberStripeCustomerId }); shopRecord.fields['Stripe customer ID'] = memberStripeCustomerId; } catch(e) {}
    }

    _mqCustomPostLink = shopRecord.fields['Marketing link'] || '';
    try {
      const savedHeadlines = shopRecord.fields['Marketing headlines'] ? JSON.parse(shopRecord.fields['Marketing headlines']) : {};
      _mqGraphicHeadline = savedHeadlines.graphic || '';
      _mqQrHeadline = savedHeadlines.qr || '';
      _mqSignHeadline = savedHeadlines.sign || '';
      _mqQrCustomColor = savedHeadlines.qrColor || '';
      _mqSignCustomColor = savedHeadlines.signColor || '';
    } catch(e) {}
    container.innerHTML = buildHTML(shopRecord.fields);
    mqInitStickyTopbar();
    mqInitStickyNav();

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
    populateRooms(shopRecord);
    await ensureProjectTypeTemplates(shopRecord);

    // Admin Templates tab only ever shows up for the Maple & Stone demo shop.
    // NOTE: adjust this exact name if your demo shop's actual 'Shop name'
    // field is spelled/punctuated differently in Airtable.
    if (shopRecord.fields['Shop name'] === 'Maple & Stone Cabinetry') {
      const navTemplates = el('mq-nav-templates');
      if (navTemplates) navTemplates.style.display = 'flex';
    }

    const leads = await loadLeads(shopRecord.fields['Shop name']);
    window._mqLeads = sortLeadsArray(leads);
    renderStats(window._mqLeads);
    el('mq-recent-leads').innerHTML = renderLeads(window._mqLeads, 5);
    el('mq-leads-table').innerHTML = renderLeads(window._mqLeads);

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
    mqToggleFloatingSave(MQ_PAGE_SAVE_ACTIONS[page] || null);
    if (page === 'marketing' || page === 'embed') {
      const socialEl = document.getElementById('mq-mk-social');
      if (socialEl && !socialEl.dataset.loaded && window._mqShopRecord) {
        socialEl.dataset.loaded = 'true';
        initMarketingKit(window._mqShopRecord);
      } else if (page === 'embed' && window._mqRawHeaderCode) {
        // Codes already loaded — just refresh the combined display
        window.mqUpdateCombinedEmbed();
      }
    }
    if (page === 'billing') {
      const planEl = document.getElementById('mq-billing-plan');
      if (planEl && planEl.textContent === 'Loading plan info...') {
        const activeActions = document.getElementById('mq-billing-active-actions');
        const reactivateActions = document.getElementById('mq-billing-reactivate-actions');
        const paymentCard = document.getElementById('mq-billing-payment-card');
        const invoicesCard = document.getElementById('mq-billing-invoices-card');
        const cancelCard = document.getElementById('mq-billing-cancel-card');
        // Airtable's Status field is updated instantly by the Stripe webhook
        // and is the source of truth for billing state — Memberstack's own
        // planConnections data lags behind real cancellations, so we don't
        // use it here.
        const status = window._mqShopRecord?.fields?.['Status'] || '';
        const isActive = status === 'Active' || status === 'Trial';
        if (isActive) {
          planEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px">${status || 'Active'}</span>
              <span style="font-size:14px;font-weight:500;color:#111">MidasQuote</span>
            </div>
            <p style="font-size:13px;color:#6b7280">Your subscription is active. Manage it using the buttons below.</p>`;
          if (activeActions) activeActions.style.display = 'flex';
          if (reactivateActions) reactivateActions.style.display = 'none';
          if (paymentCard) paymentCard.style.display = 'block';
          if (invoicesCard) invoicesCard.style.display = 'block';
          if (cancelCard) cancelCard.style.display = 'block';
        } else {
          // Status is Cancelled, Paused, or unknown — subscription isn't
          // active. The Stripe Customer Portal can't resubscribe a fully
          // cancelled sub, so we surface reactivation buttons here instead.
          const label = status || 'Inactive';
          planEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="background:#fee2e2;color:#dc2626;font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px">${label}</span>
              <span style="font-size:14px;font-weight:500;color:#111">No active plan</span>
            </div>
            <p style="font-size:13px;color:#6b7280">Your subscription has ended. You still have dashboard access for now — pick a plan below to reactivate your widget.</p>`;
          if (activeActions) activeActions.style.display = 'none';
          if (reactivateActions) reactivateActions.style.display = 'flex';
          if (paymentCard) paymentCard.style.display = 'none';
          if (invoicesCard) invoicesCard.style.display = 'none';
          if (cancelCard) cancelCard.style.display = 'none';
        }
      }
    }
    if (page === 'leads') {
      const leadsTable = document.getElementById('mq-leads-table');
      if (leadsTable && window._mqShopRecord) {
        leadsTable.innerHTML = '<div class="mq-loading">Refreshing leads...</div>';
        loadLeads(window._mqShopRecord.fields['Shop name']).then(leads => {
          window._mqLeads = sortLeadsArray(leads);
          renderStats(window._mqLeads);
          const recentEl = document.getElementById('mq-recent-leads');
          if (recentEl) recentEl.innerHTML = renderLeads(window._mqLeads, 5);
          mqFilterLeads(); // re-applies whatever status filter + sort was already active
        });
      }
    }
    if (page === 'products') {
      const prodContent = document.getElementById('mq-products-content');
      if (prodContent) {
        prodContent.innerHTML = '<div class="mq-loading">Loading your products...</div>';
        const shopToken = window._mqShopRecord.fields['Shop token'];
        Promise.all([
          loadShop(shopToken), // refetch the shop record itself fresh — this is where Photos/Hidden actually live, and a push from elsewhere (like the Templates admin tool) wouldn't otherwise show up until a full page reload
          atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${window._mqShopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`),
        ]).then(([freshShop, lineItems]) => {
          if (freshShop) window._mqShopRecord = freshShop;
          window._mqLineItems = lineItems;
          initProductsTab(window._mqShopRecord, lineItems);
        });
      }
    }
    if (page === 'templates') {
      const tmplContent = document.getElementById('mq-templates-content');
      if (tmplContent) {
        tmplContent.innerHTML = '<div class="mq-loading">Loading templates...</div>';
        renderTemplates();
      }
      const masterRoomsContent = document.getElementById('mq-master-rooms-content');
      if (masterRoomsContent) {
        masterRoomsContent.innerHTML = '<div class="mq-loading">Loading...</div>';
        renderMasterRoomDefs();
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