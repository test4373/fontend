// Profanity filter for username validation
// Turkish and English bad words

const BANNED_WORDS = [
  // Türkçe küfürler
  'amk', 'aq', 'amq', 'amına', 'amina', 'amcık', 'amcik', 'sik', 'yarrak', 
  'taşak', 'tasak', 'göt', 'got', 'piç', 'pic', 'orospu', 'kahpe', 'pezevenk',
  'am', 'amguard', 'amcı', 'amci', 'bok', 'kaka', 'sıçmak', 'sicmak',
  'eşek', 'esek', 'mal', 'salak', 'aptal', 'gerizekalı', 'gerzek',
  'sikik', 'sikerim', 'siktir', 'yarak', 'yarrağım', 'yarragim',
  'götveren', 'götoş', 'götlek', 'gotlek', 'ibne', 'top', 'homo',
  
  // Eklenen Türkçe küfürler ve hakaretler (genişletilmiş ve temizlenmiş liste)
  'hıyar', 'it', 'hayvan', 'ezik', 'yavşak', 'dallama', 'pislik', 'lavuk', 'denyo',
  'deyyus', 'dümbük', 'dürzü', 'hödük', 'zibidi', 'kavat', 'gavat', 'alagavat', 'kaşar',
  'aşüfte', 'yosma', 'yelloz', 'şıllık', 'kevaşe', 'motor', 'sürtük', 'kaltak', 'fallik',
  'fahişe', 'puşt', 'ciğersiz', 'dalyarak', 'hasiktir', 'siki', 'tuttun', 'sikimde', 'değil',
  'ciğerini', 'dalağını', 'yordamını', 'sikko', 'sikindirik', 'sikimtırak', 'sikimtronik',
  'sikim', 'sokum', 'yarak', 'kürek', 'sikimsonik', 'amına', 'ibine', 'oç', 'amcık', 'ağızlı', 'koyayım', 'koyarım',
  'sik eyim', 'sikerim', 'hoşafı', 'götünden', 'kıç', 'lalesi', 'götübozuk', 'koyayım',
  'alırım', 'göte', 'geldin', 'ağzına', 'sıçayım', 'sıçarım', 'sıçtık', 'sıçışlardayız',
  'şarap', 'çanağına', 'camına', 'bacı', 'avrat', 'ecdad',
  'ced', 'sülale', 'eşekoğlu', 'eşşek', 'avradını', 'bacını', 'yedi', 'ceddini',
  'siktiğimin', 'oğlu', 'feriştahını', 'gelmişini', 'geçmişini', 'ebesini', 'göt', 'lalesi',
  'anasını', 'avradını', 'ağzını', 'yüzünü', 'pezevengi', 'boynuzlu', 'kerata',
  'sikişken', 'kancık', 'şırfıntı', 'pıttık', 'taşşak', 'büllük', 'çük', 'kutusunu',
  'rahminde', 'değmis', 'a.q', 'agazina', 'siciyim', 'agzina', 'isiyim', 'agzinin',
  'yayini', 'akilsiz', 'biti', 'amın', 'oğlu', 'götünden', 'sikerim', 'amcık',
  'ağızlı', 'yarragı', 'agizli', 'hosafi', 'sulfat', 'amin', 'ogl u', 'osurayım',
  'yumruk', 'attigim', 'amsalak', 'anam', 'avradım', 'anan', 'sicti',
  'essek', 'gotunden', 'sikiyim', 'sikerim', 'anin', 'ami', 'amin i',
  'anasınını', 'anasi', 'sikismis', 'angut', 'annenin', 'osurugunu', 'sikerim',
  'antenle', 'otuzbir', 'cekmek', 'ass', 'hole', 'tulip', 'yarragi', 'atyarragi', 'avradini',
  'sikiyim', 'ayioglu', 'çuk', 'kafalı', 'babanin', 'amina', 'koyum', 'bacinin',
  'amina', 'geciririm', 'beyinsiz', 'sikiyim', 'bok',
  'chukumu', 'yala', 'cibilliyetini', 'sikiyim',
  'cigerini', 'sikeyim', 'amı', 'daşak', 'dallama',
  'dalyarak', 'mezarda', 'sikiyim', 'deyus', 'daşağa', 'tasagi',
  'eşeğinin', 'siki', 'ebeni', 'sikerim', 'ebinin', 'ami', 'ecdadini', 'götünden', 'sikeyim', 'kafali',
  'orospu', 'cocugu', 'eshek', 'siken', 'fahise', 'feriştasını', 'sikeyim',
  'gavat', 'götübozuk', 'götümü', 'siker', 'sikicileri', 'cukume',
  'takil', 'gevsek', 'got', 'girs in', 'gotune', 'yayi', 'girs in',
  'girtlagini', 'sikeyim', 'got', 'siken',
  'got', 'ver en', 'gotcu', 'gotoglani', 'gotu', 'boklu', 'gotu', 'sikli', 'gotunu',
  'sikeyim', 'hiyaragasi', 'ibne', 'oğlu', 'ibne', 'ibnetor', 'siker', 'itoglu',
  'it', 'izdirabini', 'sikeyim', 'kabileni', 'sikerim', 'kafana', 'siciyim', 'kalantor',
  'kanini', 'sikiyim', 'katiksiz', 'orospu', 'cocugu', 'keriz', 'kicimi', 'sikeyim', 'kopek',
  'o.ç.', 'olusunu', 'siktigimin', 'evladi', 'orosp', 'oruspu', 'cucugu',
  'ossurturum', 'otuzbirci', 'pezevengin', 'cocugu', 'pezevengin',
  'pipi', 'sadrazam', 'canagina', 'sicayim', 'sikeyim',
  'sersem', 'sikin', 'mahsulü', 'sigir', 'siki', 'sik', 'kafalı', 'japon',
  'askeri', 'sik', 'kafali', 'sik', 'kili', 'sik', 'kirigi', 'sikem', 'chichen', 'chech',
  'siki', 'tutmuş', 'sikik', 'hayvan', 'sikik', 'orospu', 'cocugu', 'sikilik',
  'herif', 'sikilmis', 'eks isozluk', 'sikimde', 'sikimin', 'eşşeği',
  'sikimin', 'kurma', 'kolu', 'sikimin', 'sikkafa', 'sikko', 'sikli', 'sultan',
  'siksiz', 'siktir', 'sirfinti', 'agizli', 'ibne',
  'sulaleni', 'sikiyim', 'sutcunin', 'cocugu', 'surtuksun', 'kaltaksin',
  'tarladaki', 'bacini', 'sikeyim', 'tassakli', 'siksin', 'ebeni', 'terlikli',
  'orospunun', 'oglu', 'toynagini', 'sikeyim', 'travesti', 'tunek', 'tupcunun', 'cocugu',
  'bozi', 'yaragimin', 'basi', 'yarak', 'kafali', 'yarragimin', 'anteni',
  'yarrak', 'embesil', 'dangalak', 'öküz', 'sığır', 'manda', 'şırfıntı', 'otuz', 'birci',
  'ağzını', 'yüzünü', 'ul an', 'anasını', 'sikişken', 'kancık',
  'pıttık', 'taşşak', 'yarragi', 'değmis', 'orospu', 'cocugu', 'ayagindan', 'yarragı', 'avradini', 'sikiyim',
  'kafali', 'sikiyim', 'kafalı', 'sikiyim', 'kafali', 'sikiyim', 'kafali', 'sikiyim',
  'ibne', 'oğlu', 'ibne', 'ibnetor', 'siker', 'itoglu', 'it', 'izdirabini',
  'amına', 'sikeyim', 'kabileni', 'sikerim', 'kafana', 'siciyim', 'kalantor', 'kanini',
  'çakayım', 'kopek', 'beyinli', 'mal', 'degneyi', 'muslumanin',
  'o.ç.', 'olusunu', 'siktigimin', 'evladi', 'orosp', 'oruspu', 'cucugu',
  'ossurturum', 'otuzbirci', 'pezevengin', 'cocugu', 'pezevengin',
  'pipi', 'sadrazam', 'canagina', 'sicayim', 'sikeyim',
  'sersem', 'sikin', 'mahsulü', 'sigir', 'siki', 'sik', 'kafalı', 'japon',
  'orospi', 'irispi', 'mk', 'emuna', 'amina', 'eşeksiken', 'amdelen', 'döl', 'amınferyadı',
  'irispiçocu', 'oçcocu', 'oçoçuğu', 'orespi', 'ibiş', 'ipine', 'ib', 'orispi', 'orospe', 
  'orespu', 'erispi', 

  // English swear words
  'pussy', 'dick', 'cock', 'fuck', 'shit', 'bitch', 'ass', 'asshole',
  'damn', 'hell', 'bastard', 'cunt', 'whore', 'slut', 'fag', 'nigger',
  
  // Eklenen English küfürler (genişletilmiş liste)
  'motherfucker', 'dickhead', 'dumbass', 'goddamn', 'goddamnit', 'jesus', 'christ', 'piss',
  'sonofabitch', 'prick', 'penis', 'pillock', 'frigging', 'bollocks', 'crap', 'slapper',
  'arse', 'dork', 'nonce', 'tits', 'moron', 'cretin', 'bell', 'bellend', 'berk', 'bint',
  'blimey', 'blighter', 'bloody', 'wanker', 'twat', 'knob', 'shag', 'bugger', 'sod', 'git',
  'minger', 'slag', 'tart', 'tosser', 'ponce', 'pikey', 'chav', 'nutter', 'spaz', 'retard',
  'fucker', 'fucking', 'fucked', 'shitty', 'pissed', 'pissing', 'douche', 'douchebag',
  'jackass', 'bullshit', 'horseshit', 'cockhead', 'cum', 'jizz', 'semen', 'turd', 'fart',
  'queer', 'dyke', 'tranny', 'kike', 'spic', 'wop', 'gook', 'chink', 'paki', 'kraut',
  'nip', 'dago', 'mick', 'taig', 'abo', 'boong', 'coon', 'honky', 'redskin', 'squaw',
  'wetback', 'beaner', 'greaser', 'goober', 'cracker', 'peckerwood', 'ofay', 'haole',
  'gook', 'zipperhead', 'slope', 'dink', 'brownie', 'sandnigger', 'cameljockey', 'raghead',
  'towelhead', 'hajji', 'jihad', 'infidel', 'kafir', 'mullah', 'taliban', 'alqaeda',
  
  // Sayı kombinasyonları
  '31', '69', '420', 'seks', 'sex', 'porn', 'porno', 'nude', 'çıplak', 'ciplak',
  
  // Eklenen sayısal ve cinsel terimler
  'anal', 'blowjob', 'handjob', 'orgasm', 'masturbate', 'wank', 'jerkoff', 'fellate',
  'cunnilingus', 'fellatio', '69', 'threesome', 'gangbang', 'bukkake', 'creampie',
  
  // Spam/offensive patterns
  'admin', 'moderator', 'mod', 'system', 'zenshin', 'anilist', 'official',
  'hitler', 'nazi', 'isis', 'terrorist',
  
  // Eklenen spam ve offensive terimler
  'spam', 'bot', 'hack', 'phish', 'scam', 'fraud', 'racist', 'sexist', 'homophobe',
  'bigot', 'fascist', 'communist', 'capitalist', 'zionist', 'antisemite', 'islamophobe',
  'xenophobe', 'misogynist', 'pedophile', 'rapist', 'murderer', 'killer', 'genocide'
];

// Additional banned patterns (regex)
const BANNED_PATTERNS = [
  /\d{3,}/,           // 3+ consecutive numbers (like 3169, 1923, etc.)
  /(.)\1{2,}/,        // Same character 3+ times (like 'aaa', '111')
  /^[^a-zA-Z]/,       // Must start with letter
  /[^a-zA-Z0-9_]/,    // Only letters, numbers, underscore
];

export const validateUsername = (username) => {
  const errors = [];
  const lowerUsername = username.toLowerCase();

  // Length check
  if (username.length < 3) {
    errors.push('Kullanıcı adı en az 3 karakter olmalı');
  }
  if (username.length > 20) {
    errors.push('Kullanıcı adı en fazla 20 karakter olmalı');
  }

  // Pattern checks
  if (!/^[a-zA-Z]/.test(username)) {
    errors.push('Kullanıcı adı harf ile başlamalı');
  }

  if (/\d{3,}/.test(username)) {
    errors.push('Kullanıcı adı 3+ ardışık rakam içeremez');
  }

  if (/(.)\1{2,}/.test(username)) {
    errors.push('Kullanıcı adı aynı karakteri 3+ kez içeremez');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir');
  }

  // Profanity check
  for (const word of BANNED_WORDS) {
    if (lowerUsername.includes(word)) {
      errors.push('Kullanıcı adı uygunsuz kelime içeriyor');
      console.log(`❌ Banned word detected: "${word}"`);
      break; // Don't show which word
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Real-time username suggestion
export const suggestUsername = (username) => {
  if (!username) return '';
  
  // Remove invalid characters
  let cleaned = username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/\d{3,}/g, '') // Remove 3+ consecutive numbers
    .replace(/(.)\1{2,}/g, '$1$1'); // Max 2 same chars
  
  // Ensure starts with letter
  if (!/^[a-z]/.test(cleaned)) {
    cleaned = 'user_' + cleaned;
  }
  
  // Remove banned words
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  
  // Limit length
  if (cleaned.length > 20) {
    cleaned = cleaned.substring(0, 20);
  }
  
  return cleaned;
};

// Check if username is available (for display purposes)
export const getUsernameSuggestions = (baseUsername) => {
  const suggestions = [];
  const cleaned = suggestUsername(baseUsername);
  
  if (cleaned.length >= 3) {
    suggestions.push(cleaned);
    suggestions.push(cleaned + '_' + Math.floor(Math.random() * 100));
    suggestions.push(cleaned + Math.floor(Math.random() * 10));
  }
  
  return suggestions.filter(s => validateUsername(s).isValid);
};

// Yorum için profanity kontrolü
export const checkCommentProfanity = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      isClean: false,
      bannedWords: []
    };
  }

  const lowerText = text.toLowerCase();
  const foundWords = [];

  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      foundWords.push(word);
    }
  }

  return {
    isClean: foundWords.length === 0,
    bannedWords: foundWords
  };
};
