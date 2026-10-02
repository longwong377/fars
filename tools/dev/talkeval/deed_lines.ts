// D-456 (with D-459): the deed eval's free-speech lines and what each means, written by hand from VERBS' senses (deeds/verbs.ts:
// the verb is the stranger's deed as the PERSON meets it: "Teach me to weave" is teach (they teach him), "Lend me silver" is
// borrow, "Take this bread" is give). [said, accepted verbs, expected fields]; who: you (the person spoken to), other (him,
// her, that man), named (a name or a kin word). Fields not given are not scored. 'none': talk only.
export type Who = 'you' | 'other' | 'named';
export interface DeedLine { said: string; verbs: string[]; act?: string[]; good?: string[]; who?: Who; name?: string; qty?: number; when?: string; force?: string[] }
const L = (said: string, verbs: string | string[], x: Omit<DeedLine, 'said' | 'verbs'> = {}): DeedLine => ({ said, verbs: Array.isArray(verbs) ? verbs : [verbs], ...x });

export const DEED_LINES: DeedLine[] = [
  // together: work and pastimes
  L("Let's go hunting tomorrow.", 'join', { act: ['fowl'], when: 'tomorrow' }), L('Come fishing with me at dawn.', 'join', { act: ['fish'] }),
  L('Shall we dance tonight?', 'join', { act: ['play'], when: 'tonight' }), L('Come and drink beer with me tonight.', ['share_food', 'join'], { act: ['eat'], good: ['beer', 'none'], when: 'tonight' }),
  L("Let's sing together.", 'join', { act: ['chant'] }), L('Will you play a game of dice with me?', 'join', { act: ['gamble', 'play'] }),
  L("Let's go swimming in the river.", 'join', { act: ['wash'] }), L('Walk with me to the market.', ['come_with', 'join'], { act: ['walk', 'none'] }),
  L('Come, we will gather firewood together.', 'join', { act: ['gather'] }), L("Let's grind the barley together.", ['join', 'help'], { act: ['grind'] }),
  L('I will help you with the harvest.', 'help', { act: ['reap', 'field_work'] }), L('Let me help you carry that.', ['help', 'carry'], {}),
  L('Let me help you fix your roof.', ['repair', 'help'], { act: ['mould_brick'] }), L('I can mend that wall for you.', 'repair', { act: ['mould_brick', 'lay_brick'] }),
  L('Can I help you draw water from the well?', 'help', { act: ['draw_water'] }), L('Let me weave with you for a while.', ['join', 'help'], { act: ['weave'] }),
  L('I will help you herd the sheep.', 'help', { act: ['herd', 'tend_animals'] }), L('Let me knead the dough for you.', 'help', { act: ['knead', 'bake'] }),
  L("Let's build a pen for the goats.", 'build', {}), L('Together we can build a new oven.', 'build', {}),
  L('Let me tend the fire for you.', 'help', { act: ['tend_fire'] }), L('I will help you thresh the grain.', 'help', { act: ['thresh'] }),
  L('Shall we eat together?', 'share_food', { act: ['eat'] }), L('Come and share my bread.', 'share_food', { act: ['eat'], good: ['bread', 'none'] }),
  // teaching
  L('Teach me to weave.', 'teach', { act: ['weave'] }), L('Show me how you make bricks.', 'teach', { act: ['mould_brick'] }),
  L('Teach me your word for water.', 'teach', {}), L('Can you teach me to fish?', 'teach', { act: ['fish'] }),
  L('I will teach you how to read the stars.', 'learn', {}), L('Let me show you how we press oil in my country.', 'learn', { act: ['press_oil'] }),
  // work for pay
  L('I will pay you to carry my pack to the road station.', 'hire', {}), L('Work for me tomorrow and I will give you silver.', 'hire', { when: 'tomorrow' }),
  L('Can I work for you? I am strong.', ['help', 'hire'], {}),
  // goods
  L('Take this bread, it is yours.', 'give', { good: ['bread'] }), L('Here, have two loaves of bread.', 'give', { good: ['bread'], qty: 2 }),
  L('I want to give you this cloth.', 'give', { good: ['cloth'] }), L('Accept this silver as a gift.', 'give', { good: ['silver'] }),
  L('Lend me two shekels of silver until the harvest.', 'borrow', { good: ['silver'], qty: 2 }), L('Could you lend me a tool for the day?', 'borrow', { good: ['tool'] }),
  L('May I borrow your donkey?', 'borrow', { good: ['animal'] }), L('I will lend you some grain until the harvest.', 'lend', { good: ['grain'] }),
  L('Take this silver as a loan; pay me back after the harvest.', 'lend', { good: ['silver'] }), L('Give me some water, please.', 'ask_for', { good: ['water'] }),
  L('Could you spare a little bread for a hungry man?', 'ask_for', { good: ['bread', 'food'] }), L('I need a jar of oil. Will you give it to me?', 'ask_for', { good: ['oil'] }),
  L("I'll steal his goat.", 'steal', { good: ['animal'], who: 'other' }), L('I am going to take your bread whether you like it or not.', 'steal', { good: ['bread'] }),
  L('I took your knife by mistake; here it is back.', 'return', { good: ['tool'] }), L('Here is the silver I owe you.', 'return', { good: ['silver'] }),
  L('I want to trade my cloth for your grain.', ['give', 'ask_for', 'borrow'], { good: ['cloth', 'grain'] }),
  // words that do something
  L('Tell your father that Bagadata stole the goat.', 'tell', { who: 'named', name: 'father' }), L('Tell the smith I will come tomorrow.', 'tell', { who: 'named', name: 'smith' }),
  L('Did you know the river has flooded the lower fields?', ['tell', 'warn', 'none'], {}), L('I bring news: the caravan from Susa has arrived.', 'tell', {}),
  L('I am the son of a king in my own land.', 'lie', {}), L('I am a priest of great power, you must obey me.', 'lie', {}),
  L('I swear I will bring you bread tomorrow.', 'promise', { when: 'tomorrow' }), L('I promise to come back before the new moon.', 'promise', {}),
  L('If you say a word I will hurt you.', 'threaten', {}), L('Give me your silver or I will burn your house.', 'threaten', {}),
  L('Watch out, there is a snake by your door!', 'warn', {}), L('Be careful of that man, he is a thief.', 'warn', { who: 'other' }),
  L("I'm sorry for what I said.", 'apologize', {}), L('Forgive me, I did not mean to offend you.', 'apologize', {}),
  L('Thank you for the water.', 'thank', {}), L('I am grateful for your kindness.', 'thank', {}),
  L('Your weaving is the finest I have ever seen.', 'praise', {}), L('You are a brave man.', 'praise', {}),
  L('You are a fool and a thief.', 'insult', {}), L('Your bread tastes like dust.', ['insult', 'mock'], {}),
  L('Look at him, he walks like a lame donkey!', 'mock', { who: 'other' }), L('Ha! You cannot even lift a jar.', 'mock', {}),
  L('May the gods curse your house!', 'curse', {}), L('I curse you and all your sons.', 'curse', {}),
  L('Do not weep, your son will get well.', 'comfort', {}), L('I am sorry your husband died. He was a good man.', 'comfort', {}),
  L('I will tell you a secret: I have no money at all.', 'confide', {}), L('Between us, I am afraid of the guards.', 'confide', {}),
  L('Your eyes are lovely.', 'flirt', {}), L('You have a beautiful smile.', 'flirt', {}),
  L('I wish to ask your father for your hand.', 'court', {}), L('Will you marry me?', 'court', {}),
  L('May the gods bless you and your house.', 'bless', {}), L('May your fields be full this year.', 'bless', {}),
  L('I forgive you for the bread you took.', 'forgive', {}), L('It is forgotten; I hold nothing against you.', 'forgive', {}),
  L('You stole my cloak!', 'accuse', {}), L('That man lied to me about the price.', ['accuse', 'complain'], { who: 'other' }),
  L('Your neighbour cheated me at the market.', 'complain', { who: 'named', name: 'neighbour' }), L('The overseer beats his workers; I want to complain.', 'complain', { who: 'named', name: 'overseer' }),
  L('Please speak for that family to the headman.', 'intercede', {}), L('Will you plead for my friend before the judge?', 'intercede', {}),
  L('You and your brother should make peace.', 'reconcile', { who: 'named', name: 'brother' }), L('Let us end this quarrel and be friends.', 'reconcile', {}),
  L('Introduce me to your father.', 'introduce', { who: 'named', name: 'father' }), L('I would like to meet the headman of your village.', ['introduce', 'bring'], { who: 'named', name: 'headman' }),
  // the body
  L("I'll fight him!", 'attack', { who: 'other' }), L('I will beat you senseless.', 'attack', { force: ['hard', 'deadly'] }),
  L('I am going to kill you.', ['attack', 'threaten'], { force: ['deadly'] }), L('Get out of my way!', 'push', {}),
  L('I shove the man aside.', 'push', { who: 'other' }), L('Come here, let me hug you, friend.', 'embrace', {}),
  L('Let me bind that wound on your arm.', 'heal', {}), L('I know herbs; I can help your sick child.', 'heal', { who: 'named', name: 'child' }),
  L('Let me carry that jar for you.', 'carry', {}), L('I will carry your sacks to the store.', 'carry', {}),
  L('Fetch me some water from the well.', 'fetch', { good: ['water'] }), L('Go and get your mother for me.', ['fetch', 'bring'], { who: 'named', name: 'mother' }),
  L('Bring your husband here, I want to speak to him.', 'bring', { who: 'named', name: 'husband' }), L('Call the smith for me.', ['bring', 'fetch'], { who: 'named', name: 'smith' }),
  L('I will smash your pots.', 'break', {}), L('I kick down the fence of your garden.', 'break', {}),
  L('I will keep watch over your house tonight.', 'guard', { when: 'tonight' }), L('Let me guard your sheep while you sleep.', 'guard', {}),
  // where people go
  L('Come with me to the river.', 'come_with', {}), L('Will you walk with me to the Terrace?', 'come_with', {}),
  L('Show me the way to the well.', ['come_with', 'none'], {}), L('Take me to your house.', ['visit', 'come_with'], {}),
  L('May I visit your house this evening?', 'visit', { when: 'tonight' }), L('I will come to your home tomorrow.', 'visit', { when: 'tomorrow' }),
  L('Meet me at the well at sunset.', 'meet', { when: 'tonight' }), L('Let us meet tomorrow at the market.', 'meet', { when: 'tomorrow' }),
  L('Run and tell the baker I need bread.', 'send', { who: 'named', name: 'baker' }), L('Take this message to the scribe.', 'send', { who: 'named', name: 'scribe' }),
  L('Go away, leave me alone.', 'dismiss', {}), L('Begone! I do not want to see you.', 'dismiss', {}),
  L('I will keep away from your house from now on.', 'avoid', {}), L('I will not come near your family again.', 'avoid', {}),
  // the gods
  L("Let's pray together to the gods.", 'pray', {}), L('Pray with me for rain.', 'pray', {}),
  L('Come, we will make an offering to the gods.', 'offer', {}), L('I want to give a lamb to the god at the altar.', 'offer', {}),
  // talk only (no deed)
  L('Where is the well?', 'none'), L('What is your name?', 'none'), L('How old are you?', 'none'), L('Who lives in your house?', 'none'),
  L('What work do you do?', 'none'), L('Is the river far from here?', 'none'), L('Nice weather today.', 'none'), L('Why are you sad?', 'none'),
  L('What do you think of the king?', 'none'), L('How is your harvest this year?', 'none'), L('Where are you from?', 'none'), L('What is that great terrace up there?', 'none'),
  L('Tell me about your family.', 'none'), L('Do you know the smith?', 'none'), L('The bread here smells good.', ['none', 'praise']),
  L('I am tired after the long road.', ['none', 'confide']), L('When does the market open?', 'none'),
];
