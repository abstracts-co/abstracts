// communities.js: the four communities in the story, one for each planet, with what their page on Abstracts shows:
// a cover, a picture, a name and a line about who it is for. a/atlantis is a real community in the making and its
// description is its own. The other three are examples made up for this story.
const pic = (inner, view = '0 0 120 60') => `<svg viewBox="${view}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;

export const COMMUNITIES = {
  builders: {
    slug: 'a/builders', audience: 'For\n*builders.*',
    description: 'People who make worlds with their AI, and build on each other’s. Post a game, a scene or a tool, and the next person adds to it.',
    cover: pic('<g shape-rendering="crispEdges"><rect width="120" height="60" fill="#58b3e6"/><rect x="8" y="14" width="104" height="38" fill="#8fd16a"/><rect x="0" y="22" width="14" height="22" fill="#8fd16a"/><rect x="54" y="14" width="10" height="38" fill="#ecd9a9"/><rect x="20" y="30" width="80" height="8" fill="#ecd9a9"/><rect x="24" y="18" width="10" height="8" fill="#2f8f4a"/><rect x="88" y="42" width="10" height="8" fill="#2f8f4a"/><rect x="72" y="18" width="18" height="10" fill="#fbf4e4"/><rect x="70" y="14" width="22" height="5" fill="#ef6b4e"/><rect x="30" y="42" width="16" height="8" fill="#3f9a46"/><rect x="57" y="32" width="4" height="4" fill="#ef6b4e"/><rect x="57" y="38" width="4" height="4" fill="#7d5ba6"/><rect x="36" y="44" width="4" height="4" fill="#ffd766"/></g>'),
    avatar: pic('<rect width="40" height="40" fill="#1f2436"/><path d="M20 8l11 6v12l-11 6-11-6V14z" fill="#ff8a1f"/><path d="M20 8l11 6-11 6-11-6z" fill="#ffd766"/><path d="M20 20v12l11-6V14z" fill="#e4480f"/>', '0 0 40 40'),
  },
  atlantis: {
    slug: 'a/atlantis', audience: 'For the\n*curious.*',
    description: 'Where was Atlantis? Every proposed place on a 3D Earth with its sea floor, Plato’s city rebuilt to his own measurements, and the ancient texts and modern research indexed for you and your agent.',
    cover: pic('<defs><radialGradient id="cm-sea" cx=".5" cy=".55" r=".8"><stop offset="0" stop-color="#3fa7c9"/><stop offset=".55" stop-color="#17508a"/><stop offset="1" stop-color="#0a1f44"/></radialGradient></defs><rect width="120" height="60" fill="url(#cm-sea)"/><g fill="none" stroke="#e9d9a8"><ellipse cx="60" cy="33" rx="34" ry="15" stroke-width="5"/><ellipse cx="60" cy="33" rx="22" ry="9.500" stroke-width="3.500"/></g><ellipse cx="60" cy="33" rx="10" ry="4.500" fill="#e9d9a8"/><ellipse cx="60" cy="32" rx="3.500" ry="1.600" fill="#ffd766"/><path d="M60 33h36" stroke="#3fa7c9" stroke-width="2.200"/>'),
    avatar: pic('<rect width="40" height="40" fill="#0f2f5c"/><g fill="none" stroke="#e9d9a8" stroke-width="3"><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="7"/></g><circle cx="20" cy="20" r="2.500" fill="#ffd766"/>', '0 0 40 40'),
  },
  trip: {
    slug: 'a/coast-trip', audience: 'For your\n*friends.*', locked: true, members: 6,
    description: 'Six friends, one car, three days up the California coast. The stops, the votes and the plan, all in one place.',
    cover: pic('<defs><linearGradient id="cm-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5a"/><stop offset=".5" stop-color="#ff6f91"/><stop offset="1" stop-color="#6a5acd"/></linearGradient></defs><rect width="120" height="60" fill="url(#cm-dusk)"/><circle cx="84" cy="30" r="11" fill="#ffe08a"/><path d="M0 40q30-10 60-2t60-6v28H0z" fill="#2a6f97"/><path d="M0 44q26-14 52-4t38 4 30-8v24H0z" fill="#1f4e5f"/><path d="M-4 58q30-22 62-14t66-18" fill="none" stroke="#ffd766" stroke-width="1.600" stroke-dasharray="4 4"/>'),
    avatar: pic('<rect width="40" height="40" fill="#1f6f8b"/><path d="M20 8a9 9 0 0 1 9 9c0 6.500-9 15-9 15s-9-8.500-9-15a9 9 0 0 1 9-9z" fill="#fff"/><circle cx="20" cy="17" r="3.600" fill="#ff7a14"/>', '0 0 40 40'),
  },
  house: {
    slug: 'a/our-house', audience: 'For your\n*house.*', locked: true, members: 6,
    description: 'Our house. Every memory worth keeping, and what we do next. Only members can see it.',
    cover: pic('<rect width="120" height="60" fill="#2a2140"/><g fill="#fff"><circle cx="14" cy="9" r=".9"/><circle cx="38" cy="6" r=".7"/><circle cx="100" cy="10" r=".9"/><circle cx="76" cy="5" r=".6"/></g><rect x="38" y="26" width="44" height="34" fill="#fbf4e4"/><path d="M32 28 60 9l28 19z" fill="#ef6b4e"/><rect x="55" y="42" width="10" height="18" fill="#7a4f2e"/><rect x="43" y="33" width="9" height="9" fill="#ffd766"/><rect x="68" y="33" width="9" height="9" fill="#ffd766"/><path d="M0 22q30 10 60 0t60 0" fill="none" stroke="#ffd766" stroke-width=".7"/><g fill="#ff6b9d"><circle cx="12" cy="25.500" r="1.800"/><circle cx="108" cy="25.500" r="1.800"/></g><g fill="#32ade6"><circle cx="24" cy="27.400" r="1.800"/><circle cx="96" cy="27.400" r="1.800"/></g>'),
    avatar: pic('<rect width="40" height="40" fill="#ff5c8a"/><path d="M8 20 20 9l12 11v11H8z" fill="#fff"/><rect x="17" y="23" width="6" height="8" fill="#ff5c8a"/>', '0 0 40 40'),
  },
};
