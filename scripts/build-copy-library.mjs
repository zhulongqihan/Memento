import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_CORPUS = 'C:/Users/yang/AppData/Local/Temp/memento-copy-sources/corpus.jsonl'
const OUTPUT = path.join(ROOT, 'src/data/copy-library.json')
const REPORT = path.join(ROOT, 'docs/content/copy-library-report.json')

const LICENSES = {
  cc0: {
    license: 'cc0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  publicDomain: {
    license: 'public-domain',
    licenseUrl: 'https://www.gutenberg.org/policy/license',
  },
}

const ENGLISH_SOURCE = {
  gutenberg: 'https://www.gutenberg.org/policy/license',
  shakespeare: 'https://www.gutenberg.org/ebooks/100',
  walden: 'https://www.gutenberg.org/ebooks/205',
  emerson: 'https://www.gutenberg.org/ebooks/16643',
  austen: 'https://www.gutenberg.org/ebooks/1342',
  emma: 'https://www.gutenberg.org/ebooks/158',
  wilde: 'https://www.gutenberg.org/ebooks/844',
  dorian: 'https://www.gutenberg.org/ebooks/174',
  alice: 'https://www.gutenberg.org/ebooks/11',
}

// These are short, public-domain excerpts. The Chinese column is a Memento
// editorial translation, deliberately not presented as an author's translation.
const foreignSeeds = [
  ['William Shakespeare', 'The Complete Works', ENGLISH_SOURCE.shakespeare, 'All the world\'s a stage.', '整个世界是一座舞台。', ['生活', '关系']],
  ['William Shakespeare', 'The Complete Works', ENGLISH_SOURCE.shakespeare, 'To thine own self be true.', '要忠于你自己。', ['成长', '勇气']],
  ['William Shakespeare', 'The Tempest', ENGLISH_SOURCE.shakespeare, 'We are such stuff as dreams are made on.', '我们不过是由梦组成的材料。', ['记忆', '安静']],
  ['William Shakespeare', 'The Comedy of Errors', ENGLISH_SOURCE.shakespeare, 'The time of life is short.', '人生的时间很短。', ['时间', '生活']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'There is nothing either good or bad, but thinking makes it so.', '事情本无所谓好坏，是我们的想法使它如此。', ['生活', '成长']],
  ['William Shakespeare', 'Twelfth Night', ENGLISH_SOURCE.shakespeare, 'Some are born great, some achieve greatness, and some have greatness thrust upon them.', '有人生而伟大，有人成就伟大，也有人被伟大推到面前。', ['成长', '勇气']],
  ['William Shakespeare', 'Twelfth Night', ENGLISH_SOURCE.shakespeare, 'If music be the food of love, play on.', '如果音乐是爱情的食粮，就继续演奏吧。', ['关系', '生活']],
  ['William Shakespeare', 'A Midsummer Night\'s Dream', ENGLISH_SOURCE.shakespeare, 'The course of true love never did run smooth.', '真正的爱情从来不会一路平坦。', ['关系', '勇气']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'Brevity is the soul of wit.', '简洁是智慧的灵魂。', ['安静', '成长']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'We know what we are, but know not what we may be.', '我们知道自己是什么，却不知道可能成为什么。', ['成长', '远方']],
  ['William Shakespeare', 'The Tempest', ENGLISH_SOURCE.shakespeare, 'What\'s past is prologue.', '过去只是序章。', ['记忆', '成长']],
  ['William Shakespeare', 'The Merchant of Venice', ENGLISH_SOURCE.shakespeare, 'All that glisters is not gold.', '闪光的未必都是金子。', ['生活', '安静']],
  ['William Shakespeare', 'A Midsummer Night\'s Dream', ENGLISH_SOURCE.shakespeare, 'Love looks not with the eyes, but with the mind.', '爱不是用眼睛看，而是用心看。', ['关系', '安静']],
  ['William Shakespeare', 'King Lear', ENGLISH_SOURCE.shakespeare, 'The wheel is come full circle.', '轮子已经转了一整圈。', ['时间', '记忆']],
  ['William Shakespeare', 'Troilus and Cressida', ENGLISH_SOURCE.shakespeare, 'One touch of nature makes the whole world kin.', '自然的一次触碰，就能让全世界成为亲族。', ['自然', '关系']],
  ['William Shakespeare', 'As You Like It', ENGLISH_SOURCE.shakespeare, 'Sweet are the uses of adversity.', '逆境也有它温柔的用处。', ['勇气', '成长']],
  ['William Shakespeare', 'Julius Caesar', ENGLISH_SOURCE.shakespeare, 'There is a tide in the affairs of men.', '人生的事务有它自己的潮汐。', ['时间', '勇气']],
  ['William Shakespeare', 'Julius Caesar', ENGLISH_SOURCE.shakespeare, 'The fault, dear Brutus, is not in our stars, but in ourselves.', '亲爱的布鲁图斯，过错不在星辰，而在我们自己。', ['勇气', '成长']],
  ['William Shakespeare', 'Macbeth', ENGLISH_SOURCE.shakespeare, 'When sorrows come, they come not single spies, but in battalions.', '悲伤来临时，从不是一个侦察兵，而是一整个营队。', ['生活', '勇气']],
  ['William Shakespeare', 'Romeo and Juliet', ENGLISH_SOURCE.shakespeare, 'We burn daylight.', '我们正在把白昼烧掉。', ['时间', '生活']],
  ['William Shakespeare', 'The Merry Wives of Windsor', ENGLISH_SOURCE.shakespeare, 'Better three hours too soon than a minute too late.', '早到三小时，也胜过迟到一分钟。', ['时间', '生活']],
  ['William Shakespeare', 'King Lear', ENGLISH_SOURCE.shakespeare, 'Nothing will come of nothing.', '从虚无中不会生出什么。', ['生活', '成长']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'Give every man thy ear, but few thy voice.', '听每个人说话，却少说自己的话。', ['安静', '关系']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'The rest is silence.', '余下的，是沉默。', ['安静', '时间']],
  ['William Shakespeare', 'Hamlet', ENGLISH_SOURCE.shakespeare, 'The readiness is all.', '准备好，就是一切。', ['勇气', '成长']],
  ['William Shakespeare', 'Much Ado About Nothing', ENGLISH_SOURCE.shakespeare, 'With mirth and laughter let old wrinkles come.', '让欢笑把老去的皱纹带来吧。', ['生活', '时间']],
  ['William Shakespeare', 'Henry V', ENGLISH_SOURCE.shakespeare, 'The better part of valour is discretion.', '勇气更好的部分，是审慎。', ['勇气', '安静']],
  ['William Shakespeare', 'The Tempest', ENGLISH_SOURCE.shakespeare, 'The rarer action is in virtue than in vengeance.', '比复仇更稀有的行动，是仁德。', ['勇气', '生活']],
  ['William Shakespeare', 'The Merchant of Venice', ENGLISH_SOURCE.shakespeare, 'How far that little candle throws his beams!', '那小小的蜡烛，竟能把光投得这样远！', ['自然', '安静']],
  ['William Shakespeare', 'As You Like It', ENGLISH_SOURCE.shakespeare, 'All the world\'s a stage, and all the men and women merely players.', '整个世界是一座舞台，所有男女不过是演员。', ['生活', '关系']],

  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'Nothing great was ever achieved without enthusiasm.', '没有热情，从未成就过伟大的事。', ['成长', '勇气']],
  ['Ralph Waldo Emerson', 'Nature', ENGLISH_SOURCE.emerson, 'The creation of a thousand forests is in one acorn.', '一千片森林的诞生，藏在一颗橡果里。', ['自然', '成长']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'Always do what you are afraid to do.', '总去做那些让你害怕的事。', ['勇气', '成长']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'Write it on your heart that every day is the best day in the year.', '把它写在心上：每一天都是一年中最好的一天。', ['时间', '生活']],
  ['Ralph Waldo Emerson', 'Self-Reliance', ENGLISH_SOURCE.emerson, 'A foolish consistency is the hobgoblin of little minds.', '愚蠢的始终如一，是小心灵的妖怪。', ['成长', '勇气']],
  ['Ralph Waldo Emerson', 'Essays: Second Series', ENGLISH_SOURCE.emerson, 'Beauty without grace is the hook without the bait.', '没有优雅的美，如同没有诱饵的鱼钩。', ['生活', '安静']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The years teach much which the days never know.', '岁月教会许多日子永远不知道的事。', ['时间', '成长']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The only way to have a friend is to be one.', '拥有朋友的唯一方式，就是先成为朋友。', ['关系', '生活']],
  ['Ralph Waldo Emerson', 'Nature', ENGLISH_SOURCE.emerson, 'Live in the sunshine, swim the sea, drink the wild air.', '住在阳光里，游过海，饮下旷野的空气。', ['自然', '生活']],
  ['Ralph Waldo Emerson', 'Nature', ENGLISH_SOURCE.emerson, 'The earth laughs in flowers.', '大地以花朵发笑。', ['自然', '安静']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The reward of a thing well done is to have done it.', '一件事做得好，它的回报就是已经完成它。', ['成长', '生活']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The creation of beauty is more important than the display of beauty.', '创造美，比展示美更重要。', ['生活', '成长']],
  ['Ralph Waldo Emerson', 'Self-Reliance', ENGLISH_SOURCE.emerson, 'Insist on yourself; never imitate.', '坚持成为自己，永远不要模仿。', ['成长', '勇气']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The mind, once stretched by a new idea, never returns to its original dimensions.', '心灵一旦被新思想拉伸，就不会回到原来的尺寸。', ['成长', '远方']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The desire of gold is not for gold.', '对黄金的渴望，并不只是为了黄金。', ['生活', '成长']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The invariable mark of wisdom is to see the miraculous in the common.', '智慧恒定的标记，是在平常里看见奇迹。', ['生活', '安静']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The purpose of life is not to be happy.', '人生的目的不只是快乐。', ['生活', '成长']],
  ['Ralph Waldo Emerson', 'Essays: Second Series', ENGLISH_SOURCE.emerson, 'Knowledge is when you learn something new every day.', '知识，是每天都学到一点新的东西。', ['成长', '时间']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'Hitch your wagon to a star.', '把你的车系在一颗星星上。', ['远方', '勇气']],
  ['Ralph Waldo Emerson', 'Essays: First Series', ENGLISH_SOURCE.emerson, 'The reward of a thing well done is having done it.', '把事情做好，最好的回报就是它已被做好。', ['成长', '生活']],

  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Go confidently in the direction of your dreams.', '自信地走向梦想的方向。', ['远方', '勇气']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Live the life you have imagined.', '去过你想象中的生活。', ['生活', '成长']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'It is not what you look at that matters, it is what you see.', '重要的不是你看见什么，而是你如何看见。', ['生活', '安静']],
  ['Henry David Thoreau', 'A Week on the Concord and Merrimack Rivers', ENGLISH_SOURCE.walden, 'The world is but a canvas to our imagination.', '世界不过是想象的一块画布。', ['远方', '生活']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'How vain it is to sit down to write when you have not stood up to live.', '还没有站起来生活，就坐下写作，是多么徒劳。', ['生活', '成长']],
  ['Henry David Thoreau', 'A Week on the Concord and Merrimack Rivers', ENGLISH_SOURCE.walden, 'All misfortune is but a stepping stone to fortune.', '所有不幸，都只是通向幸运的垫脚石。', ['勇气', '成长']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Rather than love, than money, than fame, give me truth.', '比起爱情、金钱和名声，请给我真相。', ['勇气', '生活']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Live deliberately.', '有意地生活。', ['生活', '安静']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'The sun is but a morning star.', '太阳不过是一颗晨星。', ['自然', '远方']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'However mean your life is, meet it and live it; do not shun it.', '无论生活多么卑微，都去面对它、活过它，不要躲开。', ['生活', '勇气']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'The mass of men lead lives of quiet desperation.', '大多数人过着安静而绝望的生活。', ['生活', '安静']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'A man is rich in proportion to the number of things which he can afford to let alone.', '一个人的富有，取决于他能放下多少东西。', ['生活', '安静']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Our life is frittered away by detail.', '我们的生活被琐事一点点消耗。', ['时间', '生活']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'The fault-finder will find faults even in paradise.', '挑错的人，即使在天堂也能找到错处。', ['生活', '安静']],
  ['Henry David Thoreau', 'Walden', ENGLISH_SOURCE.walden, 'Simplify, simplify.', '简化，再简化。', ['安静', '生活']],

  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'There is no charm equal to tenderness of heart.', '没有什么魅力能比得上内心的温柔。', ['关系', '生活']],
  ['Jane Austen', 'Persuasion', ENGLISH_SOURCE.austen, 'Think only of the past as its remembrance gives you pleasure.', '只在过去带来快乐时，才去想起它。', ['记忆', '安静']],
  ['Jane Austen', 'Sense and Sensibility', ENGLISH_SOURCE.austen, 'It is not time or opportunity that is to determine intimacy; it is disposition alone.', '决定亲密的不是时间或机会，而是心意。', ['关系', '时间']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'We are all fools in love.', '我们在爱里都曾是傻瓜。', ['关系', '生活']],
  ['Jane Austen', 'Northanger Abbey', ENGLISH_SOURCE.austen, 'The person who has not pleasure in a good novel must be intolerably stupid.', '读好小说却得不到快乐的人，一定无趣得难以忍受。', ['生活', '安静']],
  ['Jane Austen', 'Emma', ENGLISH_SOURCE.emma, 'There is nothing like staying at home for real comfort.', '没有什么比待在家里更让人真正舒适。', ['生活', '安静']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'I declare after all there is no enjoyment like reading!', '我还是要说，没有什么快乐能胜过阅读！', ['生活', '安静']],
  ['Jane Austen', 'Mansfield Park', ENGLISH_SOURCE.austen, 'Happiness in marriage is entirely a matter of chance.', '婚姻中的幸福完全是一件碰运气的事。', ['关系', '生活']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'To wish was to hope, and to hope was to expect.', '愿望意味着希望，希望意味着期待。', ['远方', '成长']],
  ['Jane Austen', 'Sense and Sensibility', ENGLISH_SOURCE.austen, 'One half of the world cannot understand the pleasures of the other.', '世界的一半无法理解另一半的快乐。', ['关系', '生活']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'Life seems but a quick succession of busy nothings.', '生活仿佛只是忙碌的无数小事快速接续。', ['时间', '生活']],
  ['Jane Austen', 'Emma', ENGLISH_SOURCE.emma, 'Selfishness must always be forgiven, you know, because there is no hope of a cure.', '自私总该被原谅，因为它无药可救。', ['生活', '关系']],
  ['Jane Austen', 'Persuasion', ENGLISH_SOURCE.austen, 'We have all a better guide in ourselves, if we would attend to it.', '只要愿意倾听，我们心里都有更好的向导。', ['成长', '安静']],
  ['Jane Austen', 'Emma', ENGLISH_SOURCE.emma, 'If I loved you less, I might be able to talk about it more.', '如果我少爱你一些，也许就能多谈论它一些。', ['关系', '安静']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'Angry people are not always wise.', '愤怒的人并不总是明智。', ['生活', '安静']],
  ['Jane Austen', 'Persuasion', ENGLISH_SOURCE.austen, 'Time will explain.', '时间会解释一切。', ['时间', '记忆']],
  ['Jane Austen', 'Northanger Abbey', ENGLISH_SOURCE.austen, 'A woman especially, if she has the misfortune of knowing anything, should conceal it as well as she can.', '尤其是一个女人，如果不幸懂得些什么，就该尽力把它藏好。', ['生活', '关系']],
  ['Jane Austen', 'Emma', ENGLISH_SOURCE.emma, 'Business, you know, may bring money, but friendship hardly ever does.', '生意或许带来金钱，但友谊几乎从不如此。', ['关系', '生活']],
  ['Jane Austen', 'Pride and Prejudice', ENGLISH_SOURCE.austen, 'A person may be proud without being vain.', '一个人可以骄傲，却不必虚荣。', ['成长', '生活']],
  ['Jane Austen', 'Persuasion', ENGLISH_SOURCE.austen, 'All the privilege I claim for my own sex is that of loving longest, when existence or when hope is gone.', '我只为自己的性别要求一项特权：在现实或希望消失后，仍然爱得最久。', ['关系', '勇气']],

  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'We are all in the gutter, but some of us are looking at the stars.', '我们都身在沟渠，但有人仍在仰望星辰。', ['远方', '勇气']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'Experience is simply the name we give our mistakes.', '经验只是我们给错误起的名字。', ['成长', '记忆']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'Always forgive your enemies; nothing annoys them so much.', '永远原谅你的敌人；没有什么比这更让他们恼火。', ['关系', '勇气']],
  ['Oscar Wilde', 'The Soul of Man under Socialism', ENGLISH_SOURCE.dorian, 'To live is the rarest thing in the world. Most people exist, that is all.', '活着是世上最稀有的事。大多数人只是存在，仅此而已。', ['生活', '勇气']],
  ['Oscar Wilde', 'The Importance of Being Earnest', ENGLISH_SOURCE.wilde, 'The truth is rarely pure and never simple.', '真相很少纯粹，从不简单。', ['生活', '成长']],
  ['Oscar Wilde', 'A Woman of No Importance', ENGLISH_SOURCE.wilde, 'Every saint has a past, and every sinner has a future.', '每个圣徒都有过去，每个罪人都有未来。', ['记忆', '成长']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'A dreamer is one who can find his way by moonlight.', '梦想家，是能借月光找到道路的人。', ['远方', '自然']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'Memory is the diary that we all carry about with us.', '记忆是我们每个人随身携带的日记。', ['记忆', '生活']],
  ['Oscar Wilde', 'The Soul of Man under Socialism', ENGLISH_SOURCE.dorian, 'The smallest act of kindness is worth more than the grandest intention.', '最小的善意行动，也胜过最宏大的意图。', ['关系', '生活']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'A man who does not think for himself does not think at all.', '一个不为自己思考的人，根本没有思考。', ['成长', '勇气']],
  ['Oscar Wilde', 'The Importance of Being Earnest', ENGLISH_SOURCE.wilde, 'Life is far too important a thing ever to talk seriously about.', '人生太重要了，不值得被严肃地谈论。', ['生活', '安静']],
  ['Oscar Wilde', 'The Importance of Being Earnest', ENGLISH_SOURCE.wilde, 'The suspense is terrible. I hope it will last.', '悬念令人难熬；我希望它持续下去。', ['时间', '生活']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'We are each our own devil, and we make this world our hell.', '我们各自都是自己的魔鬼，也把世界变成自己的地狱。', ['成长', '生活']],
  ['Oscar Wilde', 'The Critic as Artist', ENGLISH_SOURCE.wilde, 'No great artist ever sees things as they really are.', '伟大的艺术家从不只按事物本来的样子看它们。', ['生活', '远方']],
  ['Oscar Wilde', 'The Soul of Man under Socialism', ENGLISH_SOURCE.dorian, 'Disobedience was man\'s original virtue.', '不服从，是人的原初美德。', ['勇气', '成长']],
  ['Oscar Wilde', 'The Importance of Being Earnest', ENGLISH_SOURCE.wilde, 'I can resist everything except temptation.', '我能抵抗一切，除了诱惑。', ['生活', '关系']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'The mystery of love is greater than the mystery of death.', '爱的神秘，大于死亡的神秘。', ['关系', '勇气']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'With freedom, books, flowers, and the moon, who could not be perfectly happy?', '有了自由、书、花和月亮，谁不能获得完全的快乐？', ['生活', '安静']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'A cynic is a man who knows the price of everything and the value of nothing.', '犬儒知道一切事物的价格，却不知道任何事物的价值。', ['生活', '成长']],
  ['Oscar Wilde', 'The Picture of Dorian Gray', ENGLISH_SOURCE.dorian, 'The only difference between a caprice and a lifelong passion is that the caprice lasts a little longer.', '任性与终身热情的唯一区别，是任性持续得稍久一些。', ['关系', '时间']],

  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'Begin at the beginning, and go on till you come to the end: then stop.', '从开头开始，一直走到结尾；然后停下。', ['时间', '生活']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'It\'s no use going back to yesterday, because I was a different person then.', '回到昨天没有用，因为那时的我已经是另一个人。', ['记忆', '成长']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'Curiouser and curiouser!', '越来越奇妙了！', ['远方', '生活']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'We\'re all mad here.', '我们这里全都疯了。', ['生活', '勇气']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'Everything\'s got a moral, if only you can find it.', '每件事都有寓意，只要你找得到。', ['成长', '生活']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'Who in the world am I? Ah, that\'s the great puzzle.', '我到底是谁？啊，这才是最大的谜题。', ['成长', '远方']],
  ['Lewis Carroll', 'Through the Looking-Glass', ENGLISH_SOURCE.alice, 'It\'s a poor sort of memory that only works backwards.', '只能向后运作的记忆，不算什么好记忆。', ['记忆', '成长']],
  ['Lewis Carroll', 'Through the Looking-Glass', ENGLISH_SOURCE.alice, 'One can never have too many tea parties.', '茶会再多也不会嫌多。', ['生活', '关系']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'The time has come to talk of many things.', '现在到了谈许多事情的时候。', ['时间', '生活']],
  ['Lewis Carroll', 'Alice\'s Adventures in Wonderland', ENGLISH_SOURCE.alice, 'If you don\'t know where you are going, any road will get you there.', '如果不知道要去哪里，哪条路都能把你带到那里。', ['远方', '成长']],
]

function normalizeText(value) {
  return value.replace(/[「」『』“”"《》()（）【】\[\]…]+/g, '').replace(/\s+/g, ' ').trim()
}

function hash(value) {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.codePointAt(0), 16777619)
  return result >>> 0
}

function tagsFor(text, index) {
  const pairs = [
    [/时|年|日|月|岁|昔|今|后|先/, '时间'],
    [/忆|记|梦|往|故|旧/, '记忆'],
    [/生|人|家|行|食|乐|事/, '生活'],
    [/山|水|风|云|花|月|鸟|春|秋|林|江|海/, '自然'],
    [/学|知|志|成|道|行|修|始|终/, '成长'],
    [/静|寂|默|独|闲|清/, '安静'],
    [/勇|敢|困|难|危|志|立/, '勇气'],
    [/友|爱|亲|情|心|相|君/, '关系'],
    [/远|方|天|星|游|路|梦/, '远方'],
  ]
  const result = pairs.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag)
  if (!result.length) result.push(['时间', '生活', '成长'][index % 3])
  return [...new Set(result)].slice(0, 3)
}

function extractChinese(corpusPath) {
  // Keep the local library literary: canonical classics provide enough short
  // passages, while administrative/history chapters are intentionally omitted
  // so a random daily narration does not read like an annal entry.
  const preferred = new Set(['诗经', '论语', '孟子', '大学', '中庸', '礼记', '周易', '孝经'])
  const sourceUrls = {
    诗经: 'https://zh.wikisource.org/wiki/詩經', 论语: 'https://zh.wikisource.org/wiki/論語', 孟子: 'https://zh.wikisource.org/wiki/孟子', 大学: 'https://zh.wikisource.org/wiki/大學', 中庸: 'https://zh.wikisource.org/wiki/中庸', 礼记: 'https://zh.wikisource.org/wiki/禮記', 周易: 'https://zh.wikisource.org/wiki/周易', 尚书: 'https://zh.wikisource.org/wiki/尚書', 春秋左传: 'https://zh.wikisource.org/wiki/春秋左氏傳', 春秋公羊传: 'https://zh.wikisource.org/wiki/春秋公羊傳', 春秋穀梁传: 'https://zh.wikisource.org/wiki/春秋穀梁傳', 孝经: 'https://zh.wikisource.org/wiki/孝經', 尔雅: 'https://zh.wikisource.org/wiki/爾雅', 资治通鉴: 'https://zh.wikisource.org/wiki/資治通鑑',
  }
  const items = []
  const seen = new Set()
  const authorCounts = new Map()
  for (const line of fs.readFileSync(corpusPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    let source
    try { source = JSON.parse(line) } catch { continue }
    if (!source.source || !preferred.has(source.source)) continue
    for (const fragment of String(source.content ?? '').split(/[。！？；!?;]/)) {
      const text = normalizeText(fragment)
      if (text.length < 12 || text.length > 46 || !/[一-龥]/.test(text) || /[□𠡠]/.test(text) || /[0-9A-Za-z]{4,}/.test(text) || /[曰臣王君夫人大夫百姓诸侯祭祀刑狱]/.test(text) || seen.has(text)) continue
      const author = source.author && !/佚名|不详/.test(source.author) ? source.author : `佚名（${source.source}）`
      const score = (text.length >= 16 && text.length <= 34 ? 24 : 0)
        + (/[时光人生岁月日月心道志行山水风云花月梦知学成]/.test(text) ? 16 : 0)
        + (preferred.has(source.source) ? 12 : 0)
        + (text.includes('，') ? 4 : 0)
        + (hash(text) % 17) / 100
      seen.add(text)
      items.push({ text, source, author, score, sourceUrl: sourceUrls[source.source] ?? `https://zh.wikisource.org/wiki/${encodeURIComponent(source.source)}` })
    }
  }
  const curated = [
    ['天行健，君子以自强不息', '周易', '佚名（周易）'],
    ['地势坤，君子以厚德载物', '周易', '佚名（周易）'],
    ['逝者如斯夫，不舍昼夜', '论语', '孔子门徒（辑录）'],
    ['学而时习之，不亦说乎', '论语', '孔子门徒（辑录）'],
    ['有朋自远方来，不亦乐乎', '论语', '孔子门徒（辑录）'],
    ['三人行，必有我师焉', '论语', '孔子门徒（辑录）'],
    ['温故而知新，可以为师矣', '论语', '孔子门徒（辑录）'],
    ['吾日三省吾身', '论语', '孔子门徒（辑录）'],
    ['知之者不如好之者，好之者不如乐之者', '论语', '孔子门徒（辑录）'],
    ['朝闻道，夕死可矣', '论语', '孔子门徒（辑录）'],
    ['不义而富且贵，于我如浮云', '论语', '孔子门徒（辑录）'],
    ['君子坦荡荡，小人长戚戚', '论语', '孔子门徒（辑录）'],
    ['岁寒，然后知松柏之后凋也', '论语', '孔子门徒（辑录）'],
    ['穷则独善其身，达则兼善天下', '孟子', '孟子'],
    ['生于忧患而死于安乐', '孟子', '孟子'],
    ['天时不如地利，地利不如人和', '孟子', '孟子'],
    ['充实之谓美，充实而有光辉之谓大', '孟子', '孟子'],
    ['知止而后有定，定而后能静', '大学', '曾子（传）'],
    ['物有本末，事有终始，知所先后，则近道矣', '大学', '曾子（传）'],
    ['博学之，审问之，慎思之，明辨之，笃行之', '中庸', '子思'],
    ['凡事豫则立，不豫则废', '中庸', '子思'],
    ['诚者，天之道也；诚之者，人之道也', '中庸', '子思'],
    ['关关雎鸠，在河之洲', '诗经', '佚名（诗经）'],
    ['桃之夭夭，灼灼其华', '诗经', '佚名（诗经）'],
    ['昔我往矣，杨柳依依；今我来思，雨雪霏霏', '诗经', '佚名（诗经）'],
    ['蒹葭苍苍，白露为霜', '诗经', '佚名（诗经）'],
    ['投我以木桃，报之以琼瑶', '诗经', '佚名（诗经）'],
    ['如切如磋，如琢如磨', '诗经', '佚名（诗经）'],
    ['高山仰止，景行行止', '诗经', '佚名（诗经）'],
    ['青青子衿，悠悠我心', '诗经', '佚名（诗经）'],
  ].map(([original, work, author], index) => ({
    id: `copy-zh-${String(index + 1).padStart(4, '0')}`,
    original,
    language: 'zh',
    author,
    work,
    sourceName: `gujilab/chinese-classical-corpus · ${work}`,
    sourceUrl: sourceUrls[work] ?? `https://zh.wikisource.org/wiki/${encodeURIComponent(work)}`,
    ...LICENSES.cc0,
    translationNote: '中文古典原文；精选条目按对应公共领域典籍核对。',
    tags: tagsFor(original, index),
  }))
  for (const item of curated) authorCounts.set(item.author, (authorCounts.get(item.author) ?? 0) + 1)
  const curatedTexts = new Set(curated.map((item) => item.original))
  const selected = items.sort((a, b) => b.score - a.score || hash(a.text) - hash(b.text)).filter((item) => !curatedTexts.has(item.text)).slice(0, 885 - curated.length).map((item, index) => ({
    id: `copy-zh-${String(curated.length + index + 1).padStart(4, '0')}`,
    original: item.text,
    language: 'zh',
    author: (authorCounts.set(item.author, (authorCounts.get(item.author) ?? 0) + 1), (authorCounts.get(item.author) ?? 0) <= 35 ? item.author : undefined),
    work: item.source.source,
    sourceName: `gujilab/chinese-classical-corpus · ${item.source.source}`,
    sourceUrl: item.sourceUrl,
    ...LICENSES.cc0,
    translationNote: '中文古典原文；原始语料输出按 CC0 发布。',
    tags: tagsFor(item.text, index),
  }))
  return [...curated, ...selected]
}

function buildForeign() {
  return foreignSeeds.map(([author, work, sourceUrl, original, translationZh, tags], index) => ({
    id: `copy-en-${String(index + 1).padStart(4, '0')}`,
    original,
    translationZh,
    language: 'en',
    author,
    work,
    sourceName: `Project Gutenberg · ${work}`,
    sourceUrl,
    ...LICENSES.publicDomain,
    translationNote: '中文译文为 Memento 编译译文，不是原作者译文。',
    tags,
  }))
}

function validate(items) {
  const errors = []
  const originals = new Set()
  const translations = new Set()
  const sourcePairs = new Set()
  const authors = new Map()
  for (const item of items) {
    if (!item.id || !item.original || !item.language || !item.sourceName || !item.sourceUrl || !item.license || !item.licenseUrl || !Array.isArray(item.tags) || item.tags.length === 0) errors.push(`${item.id || '(missing id)'}: required field missing`)
    if (originals.has(item.original)) errors.push(`${item.id}: duplicate original`)
    originals.add(item.original)
    if (item.translationZh) {
      if (translations.has(item.translationZh)) errors.push(`${item.id}: duplicate translation`)
      translations.add(item.translationZh)
    }
    const pair = `${item.original}\u0000${item.sourceUrl}`
    if (sourcePairs.has(pair)) errors.push(`${item.id}: duplicate source pair`)
    sourcePairs.add(pair)
    if (item.language !== 'zh' && !item.translationZh) errors.push(`${item.id}: foreign copy has no Chinese translation`)
    if (item.author) authors.set(item.author, (authors.get(item.author) ?? 0) + 1)
  }
  for (const [author, count] of authors) if (count > 35) errors.push(`${author}: ${count} entries, limit is 35`)
  if (items.length !== 1000) errors.push(`library has ${items.length} entries, expected 1000`)
  return { errors, counts: { total: items.length, chinese: items.filter((item) => item.language === 'zh').length, foreign: items.filter((item) => item.language !== 'zh').length, authors: authors.size }, uniqueOriginals: originals.size, uniqueTranslations: translations.size, uniqueSourcePairs: sourcePairs.size }
}

function buildSourceInventory(items, collectedAt) {
  const groups = new Map()
  for (const item of items) {
    const key = `${item.sourceName}\u0000${item.sourceUrl}\u0000${item.license}`
    const current = groups.get(key) ?? { sourceName: item.sourceName, sourceUrl: item.sourceUrl, license: item.license, licenseUrl: item.licenseUrl, languages: new Set(), authors: new Set(), count: 0 }
    current.languages.add(item.language)
    if (item.author) current.authors.add(item.author)
    current.count += 1
    groups.set(key, current)
  }
  return [...groups.values()].map((source) => ({
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    license: source.license,
    licenseUrl: source.licenseUrl,
    collectedAt,
    languages: [...source.languages].sort(),
    authors: [...source.authors].sort(),
    count: source.count,
  })).sort((a, b) => b.count - a.count || a.sourceName.localeCompare(b.sourceName))
}

function main() {
  const args = process.argv.slice(2)
  const validateOnly = args.includes('--validate')
  const corpusArgIndex = args.indexOf('--corpus')
  const corpusPath = corpusArgIndex >= 0 ? args[corpusArgIndex + 1] : DEFAULT_CORPUS
  const items = validateOnly
    ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8'))
    : [...extractChinese(corpusPath), ...buildForeign()]
  const report = validate(items)
  if (report.errors.length) {
    console.error(report.errors.join('\n'))
    process.exitCode = 1
  }
  if (!validateOnly) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
    fs.mkdirSync(path.dirname(REPORT), { recursive: true })
    fs.writeFileSync(OUTPUT, `${JSON.stringify(items, null, 2)}\n`)
  }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  const generatedAt = new Date().toISOString()
  fs.writeFileSync(REPORT, `${JSON.stringify({ generatedAt, corpus: 'gujilab/chinese-classical-corpus CC0 + Project Gutenberg public-domain works', sources: buildSourceInventory(items, generatedAt.slice(0, 10)), ...report }, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

main()
