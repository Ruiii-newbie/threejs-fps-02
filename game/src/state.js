// Single state store: everything the sim mutates lives here (or is referenced from here).
// Modules read/write S; nothing else holds authoritative game state.
export function createState() {
  return {
    time: 0, tick: 0, started: false, paused: false, over: false, frozen: true,
    phase: 'freeze', // freeze | live | planted | over
    round: 1, scoreV: 0, scoreS: 0, roundTime: 100, freezeTime: 12, bombTime: 35,
    money: 800, kills: 0, deaths: 0, lossStreak: 0, roundKills: 0,
    bomb: { state: 'none', site: null, pos: null, plantedAt: 0, planter: null, defuser: null, progress: 0 },
    attackSite: 'A', // the site V is hitting this round (set by bots.reset)
    player: {
      pos: null, vel: null, yaw: 0, pitch: 0, eye: 1.6, onGround: true, crouching: false,
      height: 1.72, hp: 100, armor: 0, alive: true, ads: false, sprinting: false,
      weapon: 'p2000', owned: { p2000: true }, grenades: { he: 0, flash: 0, smoke: 0 },
      bloom: 0, flashBlind: 0, plantProgress: 0, defuseProgress: 0, lastDamageDir: 0, damageFlash: 0,
    },
    bots: [], // {id,team,role,site,hp,armor,alive,pos,vel,yaw,state,node,target,skill,...}
    events: [], // hearing events {x,z,r,kind,time}
    feed: [], // kill feed strings
    banner: null, bannerUntil: 0,
    winner: null, matchWinner: null,
    rngSeed: 1,
  };
}
