import { readFileSync } from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
const screen=read('src/productionGame/ProductionLobbyScreen.tsx');
const nav=read('src/navigation/AppNavigator.tsx');
const types=read('src/navigation/navigationTypes.ts');
const home=read('src/screens/HomeScreen.tsx');
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(`production-v1 lobby: ${message}`);}
assert(screen.includes('createProductionV1PrivateMatch'),'create bridge');
assert(screen.includes('acceptProductionV1PrivateMatch'),'accept bridge');
assert(screen.includes('COPY MATCH CODE'),'match sharing');
assert(screen.includes('searchAsyncDuelOpponents'),'approved player discovery');
assert(!/service[_-]?role/i.test(screen),'no privileged secret in UI');
assert(nav.includes('ProductionLobbyScreen'),'screen registered');
assert(types.includes('ProductionLobby: undefined'),'route typed');
assert(home.includes('PRODUCTION LIVE PVP'),'home entry');
console.log('production-v1 lobby self-tests passed.');