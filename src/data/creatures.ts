/**
 * 生き物のマスタデータ。
 * 生息深度はゲーム用の目安で、実際の生息環境を正確に表したものではありません。
 * 全部を突っつくには全海域を回る必要があるよう、各海域に「そこにしかいない生き物」を置いている
 * （浅瀬: ハイコウイクチス / 陽光帯: ピカイア / 薄明帯: ハルキゲニア・アイシェアイア /
 *   深海: クテノラブドトゥス・エルドニア）。
 */

export type ModelKind =
  | "anomalocaris"
  | "opabinia"
  | "trilobite"
  | "hallucigenia"
  | "marrella"
  | "pikaia"
  | "haikouichthys"
  | "wiwaxia"
  | "ctenophore"
  | "hurdia"
  | "waptia"
  | "sidneyia"
  | "aysheaia"
  | "ottoia"
  | "eldonia"
  | "dinomischus";

/**
 * 突っついたときの反応。
 * flee: 逃げる / burrow: 砂に潜る / freeze: 動きを止めて身を守る / flash: きらめいて離れる
 */
export type Reaction = "flee" | "burrow" | "freeze" | "flash";

/**
 * swim: 中層を泳ぐ / nearFloor: 海底付近を泳ぐ / crawl: 海底を這う / drift: 漂う
 * sessile: 海底に固着して動かない（speed は 0 にする）
 */
export type Behavior = "swim" | "nearFloor" | "crawl" | "drift" | "sessile";

export type Creature = {
  id: string;
  name: string;
  latin: string;
  model: ModelKind;
  behavior: Behavior;
  /** 実際の体長 (cm) */
  lengthCm: number;
  /** 出現する水深の範囲 (m) */
  depth: [number, number];
  /** 画面内に出す数 */
  count: number;
  /** 移動の速さ (体長あたり/秒) */
  speed: number;
  locality: string;
  description: string;
  trivia: string;
  reaction: Reaction;
  /** ときどき窓のすぐ前を横切る（大きな生き物の迫力を見せる） */
  flyby?: boolean;
  /** 群れで泳ぐ（動きはワーカーで計算する） */
  school?: boolean;
};

/**
 * 画面上の大きさ。実寸のままだと小さい生き物が見えないので、
 * 体長の平方根に比例させて差を縮めている。
 */
export function displayLength(c: Pick<Creature, "lengthCm">) {
  return 0.5 * Math.sqrt(c.lengthCm);
}

export const CREATURES: Creature[] = [
  {
    id: "anomalocaris",
    name: "アノマロカリス",
    latin: "Anomalocaris canadensis",
    model: "anomalocaris",
    behavior: "swim",
    lengthCm: 40,
    depth: [0, 450],
    count: 2,
    speed: 0.35,
    locality: "バージェス頁岩（カナダ）",
    description:
      "カンブリア紀最大級の捕食者。体の両脇に並んだヒレを波打たせて泳ぎ、頭の前にある一対の大きな触手で獲物を捕らえたと考えられている。",
    trivia:
      "名前は「奇妙なエビ」という意味。最初は触手だけが見つかり、エビの胴体だと思われていた。",
    flyby: true,
    reaction: "flee",
  },
  {
    id: "opabinia",
    name: "オパビニア",
    latin: "Opabinia regalis",
    model: "opabinia",
    behavior: "nearFloor",
    lengthCm: 7,
    depth: [40, 320],
    count: 3,
    speed: 0.4,
    locality: "バージェス頁岩（カナダ）",
    description:
      "頭に5つの眼をもち、先端にハサミのついた長いノズルを伸ばして海底の獲物をつまんだとされる。",
    trivia:
      "学会で復元図が初めて発表されたとき、あまりの奇妙さに会場が笑いに包まれたという逸話がある。",
    reaction: "flee",
  },
  {
    id: "olenoides",
    name: "オレノイデス（三葉虫）",
    latin: "Olenoides serratus",
    model: "trilobite",
    behavior: "crawl",
    lengthCm: 8,
    depth: [0, 1000],
    count: 8,
    speed: 0.12,
    locality: "バージェス頁岩（カナダ）",
    description:
      "硬い殻をもつ三葉虫の一種。触角や脚まで化石に残っていることで知られ、三葉虫の体のつくりを知る手がかりになった。",
    trivia:
      "三葉虫という名前は、体が縦に3つの部分（中央と左右）に分かれて見えることに由来する。",
    reaction: "burrow",
  },
  {
    id: "hallucigenia",
    name: "ハルキゲニア",
    latin: "Hallucigenia sparsa",
    model: "hallucigenia",
    behavior: "crawl",
    lengthCm: 2.5,
    depth: [200, 600],
    count: 4,
    speed: 0.15,
    locality: "バージェス頁岩（カナダ）",
    description:
      "背中にトゲ、お腹側に細い脚が並んだ小さな生き物。カギムシ（有爪動物）の遠い親戚と考えられている。",
    trivia:
      "当初はトゲを脚、脚を触手と思われ、上下逆さまに復元されていた。頭と尻尾も逆だった。",
    reaction: "freeze",
  },
  {
    id: "marrella",
    name: "マルレラ",
    latin: "Marrella splendens",
    model: "marrella",
    behavior: "nearFloor",
    lengthCm: 2,
    depth: [50, 800],
    count: 6,
    speed: 0.6,
    locality: "バージェス頁岩（カナダ）",
    description:
      "頭から後ろ向きに伸びる2対の長いトゲが特徴の節足動物。バージェス頁岩で最も多く見つかる化石のひとつ。",
    trivia:
      "化石のトゲに細かい構造が残っており、生きていたときは虹色に光って見えたのではないかと言われている。",
    school: true,
    reaction: "flee",
  },
  {
    id: "pikaia",
    name: "ピカイア",
    latin: "Pikaia gracilens",
    model: "pikaia",
    behavior: "swim",
    lengthCm: 4,
    depth: [30, 200],
    count: 5,
    speed: 0.5,
    locality: "バージェス頁岩（カナダ）",
    description:
      "体をくねらせて泳ぐ細長い生き物。背骨のもとになる脊索をもつ、私たち脊索動物の仲間と考えられている。",
    trivia:
      "「人類の祖先」として紹介されることもあるが、直接の祖先かどうかははっきりしていない。",
    school: true,
    reaction: "flee",
  },
  {
    id: "haikouichthys",
    name: "ハイコウイクチス",
    latin: "Haikouichthys ercaicunensis",
    model: "haikouichthys",
    behavior: "swim",
    lengthCm: 2.5,
    depth: [0, 30],
    count: 6,
    speed: 0.7,
    locality: "澄江（中国）",
    description:
      "最古級の脊椎動物（魚の仲間）。眼や背びれのような構造をもち、群れで泳いでいたかもしれない。",
    trivia: "アゴはまだなく、口は開いたままだったと考えられている。",
    school: true,
    reaction: "flee",
  },
  {
    id: "wiwaxia",
    name: "ウィワクシア",
    latin: "Wiwaxia corrugata",
    model: "wiwaxia",
    behavior: "crawl",
    lengthCm: 3.5,
    depth: [30, 550],
    count: 4,
    speed: 0.08,
    locality: "バージェス頁岩（カナダ）",
    description:
      "体中をウロコのような小片で覆い、背中に2列の長いトゲを立てた生き物。海底をゆっくり這って暮らしていた。",
    trivia: "貝やイカなどの軟体動物に近い仲間という説が有力。",
    reaction: "freeze",
  },
  {
    id: "ctenorhabdotus",
    name: "クテノラブドトゥス（クシクラゲ）",
    latin: "Ctenorhabdotus capulus",
    model: "ctenophore",
    behavior: "drift",
    lengthCm: 5,
    depth: [600, 1000],
    count: 6,
    speed: 0.05,
    locality: "バージェス頁岩（カナダ）",
    description:
      "クシクラゲの仲間。体にある「くし板」の列を波打たせて、ゆっくり漂うように泳ぐ。",
    trivia:
      "現生のクシクラゲのくし板は光を反射して虹色にきらめく。ここでは探照灯に照らされた姿を表現している。",
    reaction: "flash",
  },
  {
    id: "hurdia",
    name: "フルディア",
    latin: "Hurdia victoria",
    model: "hurdia",
    behavior: "swim",
    lengthCm: 20,
    depth: [250, 900],
    count: 2,
    speed: 0.3,
    locality: "バージェス頁岩（カナダ）",
    description:
      "アノマロカリスの仲間（ラディオドンタ類）。頭の前に突き出た大きな甲羅が特徴で、トゲの並んだ触手で海底の獲物をすくい取っていたと考えられている。",
    trivia:
      "体の部品がバラバラに見つかったため、長いあいだ別々の生き物として扱われていた。甲羅はエビの仲間のものだと思われていた。",
    flyby: true,
    reaction: "flee",
  },
  {
    id: "waptia",
    name: "ワプティア",
    latin: "Waptia fieldensis",
    model: "waptia",
    behavior: "nearFloor",
    lengthCm: 8,
    depth: [0, 400],
    count: 4,
    speed: 0.45,
    locality: "バージェス頁岩（カナダ）",
    description:
      "エビのような姿をした節足動物。2枚の殻で体の前半を覆い、しなやかな腹部と2枚の尾びれをもつ。",
    trivia: "殻の下に卵を抱えた化石が見つかっていて、子育てをしていた証拠としては最古級のもの。",
    school: true,
    reaction: "flee",
  },
  {
    id: "sidneyia",
    name: "シドネイア",
    latin: "Sidneyia inexpectans",
    model: "sidneyia",
    behavior: "crawl",
    lengthCm: 13,
    depth: [60, 550],
    count: 3,
    speed: 0.12,
    locality: "バージェス頁岩（カナダ）",
    description:
      "平たい体をした大型の節足動物。腸の中から三葉虫などの殻が見つかっており、海底を歩き回る捕食者だったと考えられている。",
    trivia: "バージェス頁岩を発見したウォルコットが、息子シドニーの名前にちなんで名付けた。",
    reaction: "flee",
  },
  {
    id: "aysheaia",
    name: "アイシェアイア",
    latin: "Aysheaia pedunculata",
    model: "aysheaia",
    behavior: "crawl",
    lengthCm: 4,
    depth: [200, 600],
    count: 3,
    speed: 0.1,
    locality: "バージェス頁岩（カナダ）",
    description:
      "カギムシに似た、たくさんの脚をもつ葉足動物。海綿と一緒に見つかることが多く、海綿を食べていたと考えられている。",
    trivia: "ハルキゲニアと同じ葉足動物の仲間。足先には小さなツメがある。",
    reaction: "freeze",
  },
  {
    id: "ottoia",
    name: "オットイア",
    latin: "Ottoia prolifica",
    model: "ottoia",
    behavior: "crawl",
    lengthCm: 8,
    depth: [200, 1000],
    count: 5,
    speed: 0.04,
    locality: "バージェス頁岩（カナダ）",
    description:
      "海底の泥に潜って暮らした鰓曳動物（エラヒキムシの仲間）。トゲの並んだ口を裏返すように伸ばして獲物を捕らえた。",
    trivia: "腸の中から小さな貝殻や同じ仲間が見つかっていて、共食いをしていた可能性もある。",
    reaction: "burrow",
  },
  {
    id: "eldonia",
    name: "エルドニア",
    latin: "Eldonia ludwigi",
    model: "eldonia",
    behavior: "drift",
    lengthCm: 10,
    depth: [600, 1000],
    count: 4,
    speed: 0.05,
    locality: "バージェス頁岩（カナダ）",
    description:
      "円盤のような体の生き物。体の中に渦巻き状の消化管が見える化石で知られる。海中を漂っていたとも、海底で暮らしていたとも考えられている。",
    trivia: "かつてはナマコやクラゲの仲間とされたこともあるが、今も分類ははっきりしていない。",
    reaction: "flee",
  },
  {
    id: "dinomischus",
    name: "ディノミスクス",
    latin: "Dinomischus isolatus",
    model: "dinomischus",
    behavior: "sessile",
    lengthCm: 2,
    depth: [150, 900],
    count: 5,
    speed: 0,
    locality: "バージェス頁岩（カナダ）",
    description:
      "細い柄の先に、花びらのような板が並んだ萼（がく）をもつ生き物。海底に固着して、水中の餌をこし取っていたとされる。",
    trivia: "見つかっている化石がわずかしかない、珍しい生き物。",
    reaction: "freeze",
  },
];
