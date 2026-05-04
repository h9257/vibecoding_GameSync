const os = require('os');
const path = require('path');

/**
 * 预置游戏存档路径数据库
 * 路径中的环境变量会在运行时解析
 */
const GAME_DATABASE = [
  {
    key: 'minecraft_java',
    name: 'Minecraft (Java版)',
    savePath: '%APPDATA%\\.minecraft\\saves',
    icon: '⛏️',
    category: '沙盒'
  },
  {
    key: 'minecraft_bedrock',
    name: 'Minecraft (基岩版)',
    savePath: '%LOCALAPPDATA%\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\minecraftWorlds',
    icon: '⛏️',
    category: '沙盒'
  },
  {
    key: 'terraria',
    name: 'Terraria',
    savePath: '%USERPROFILE%\\Documents\\My Games\\Terraria\\Players',
    icon: '🌳',
    category: '沙盒'
  },
  {
    key: 'stardew_valley',
    name: 'Stardew Valley',
    savePath: '%APPDATA%\\StardewValley\\Saves',
    icon: '🌾',
    category: 'RPG'
  },
  {
    key: 'elden_ring',
    name: 'Elden Ring (艾尔登法环)',
    savePath: '%APPDATA%\\EldenRing',
    icon: '⚔️',
    category: 'RPG'
  },
  {
    key: 'dark_souls_3',
    name: 'Dark Souls III (黑暗之魂3)',
    savePath: '%APPDATA%\\DarkSoulsIII',
    icon: '🗡️',
    category: 'RPG'
  },
  {
    key: 'sekiro',
    name: 'Sekiro (只狼)',
    savePath: '%APPDATA%\\Sekiro',
    icon: '🥷',
    category: 'RPG'
  },
  {
    key: 'hollow_knight',
    name: 'Hollow Knight (空洞骑士)',
    savePath: '%USERPROFILE%\\AppData\\LocalLow\\Team Cherry\\Hollow Knight',
    icon: '🦋',
    category: '动作'
  },
  {
    key: 'celeste',
    name: 'Celeste (蔚蓝)',
    savePath: '%LOCALAPPDATA%\\Celeste\\Saves',
    icon: '🍓',
    category: '平台'
  },
  {
    key: 'gta5',
    name: 'GTA V',
    savePath: '%USERPROFILE%\\Documents\\Rockstar Games\\GTA V\\Profiles',
    icon: '🚗',
    category: '动作'
  },
  {
    key: 'rdr2',
    name: 'Red Dead Redemption 2',
    savePath: '%USERPROFILE%\\Documents\\Rockstar Games\\Red Dead Redemption 2\\Profiles',
    icon: '🤠',
    category: '动作'
  },
  {
    key: 'witcher3',
    name: 'The Witcher 3 (巫师3)',
    savePath: '%USERPROFILE%\\Documents\\The Witcher 3\\gamesaves',
    icon: '🐺',
    category: 'RPG'
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk 2077 (赛博朋克2077)',
    savePath: '%USERPROFILE%\\Saved Games\\CD Projekt Red\\Cyberpunk 2077',
    icon: '🤖',
    category: 'RPG'
  },
  {
    key: 'skyrim',
    name: 'The Elder Scrolls V: Skyrim (上古卷轴5)',
    savePath: '%USERPROFILE%\\Documents\\My Games\\Skyrim Special Edition\\Saves',
    icon: '🐉',
    category: 'RPG'
  },
  {
    key: 'fallout4',
    name: 'Fallout 4 (辐射4)',
    savePath: '%USERPROFILE%\\Documents\\My Games\\Fallout4\\Saves',
    icon: '☢️',
    category: 'RPG'
  },
  {
    key: 'subnautica',
    name: 'Subnautica (深海迷航)',
    savePath: '%APPDATA%\\..\\LocalLow\\Unknown Worlds\\Subnautica\\SavedGames',
    icon: '🐟',
    category: '生存'
  },
  {
    key: 'satisfactory',
    name: 'Satisfactory (幸福工厂)',
    savePath: '%LOCALAPPDATA%\\FactoryGame\\Saved\\SaveGames',
    icon: '🏭',
    category: '建造'
  },
  {
    key: 'hades',
    name: 'Hades (哈迪斯)',
    savePath: '%USERPROFILE%\\Documents\\Saved Games\\Hades',
    icon: '🔥',
    category: 'Roguelike'
  },
  {
    key: 'cuphead',
    name: 'Cuphead (茶杯头)',
    savePath: '%APPDATA%\\Cuphead\\Slot',
    icon: '☕',
    category: '动作'
  },
  {
    key: 'animal_crossing',
    name: 'Undertale (传说之下)',
    savePath: '%LOCALAPPDATA%\\UNDERTALE',
    icon: '❤️',
    category: 'RPG'
  },
  {
    key: 'factorio',
    name: 'Factorio (异星工厂)',
    savePath: '%APPDATA%\\Factorio\\saves',
    icon: '⚙️',
    category: '建造'
  },
  {
    key: 'rimworld',
    name: 'RimWorld (环世界)',
    savePath: '%USERPROFILE%\\AppData\\LocalLow\\Ludeon Studios\\RimWorld by Ludeon Studios\\Saves',
    icon: '🌍',
    category: '模拟'
  },
  {
    key: 'ori_blind_forest',
    name: 'Ori and the Blind Forest',
    savePath: '%APPDATA%\\..\\Local\\Ori and the Blind Forest DE',
    icon: '✨',
    category: '平台'
  },
  {
    key: 'deaths_door',
    name: "Death's Door (死亡之门)",
    savePath: '%APPDATA%\\..\\LocalLow\\Acid Nerve\\DeathsDoor',
    icon: '🚪',
    category: '动作'
  },
  {
    key: 'palworld',
    name: 'Palworld (幻兽帕鲁)',
    savePath: '%LOCALAPPDATA%\\Pal\\Saved\\SaveGames',
    icon: '🐾',
    category: '生存'
  }
];

class GameDatabase {
  constructor() {
    this.games = GAME_DATABASE;
  }

  /**
   * 解析路径中的环境变量
   */
  resolvePath(savePath) {
    return savePath.replace(/%([^%]+)%/g, (match, varName) => {
      const envVal = process.env[varName];
      if (envVal) return envVal;
      // 常见回退
      switch (varName.toUpperCase()) {
        case 'USERPROFILE': return os.homedir();
        case 'APPDATA': return path.join(os.homedir(), 'AppData', 'Roaming');
        case 'LOCALAPPDATA': return path.join(os.homedir(), 'AppData', 'Local');
        default: return match;
      }
    });
  }

  /**
   * 获取所有预置游戏
   */
  getAll() {
    return this.games.map(g => ({
      ...g,
      resolvedPath: this.resolvePath(g.savePath)
    }));
  }

  /**
   * 搜索预置游戏
   */
  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.key.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  }

  /**
   * 获取所有分类
   */
  getCategories() {
    const categories = new Set(this.games.map(g => g.category));
    return [...categories].sort();
  }

  /**
   * 按分类获取游戏
   */
  getByCategory(category) {
    return this.getAll().filter(g => g.category === category);
  }

  /**
   * 通过 key 获取游戏信息
   */
  getByKey(key) {
    const game = this.games.find(g => g.key === key);
    if (!game) return null;
    return { ...game, resolvedPath: this.resolvePath(game.savePath) };
  }

  /**
   * 检查存档路径是否存在
   */
  checkPathExists(savePath) {
    const resolved = this.resolvePath(savePath);
    const fs = require('fs');
    return fs.existsSync(resolved);
  }
}

module.exports = new GameDatabase();
