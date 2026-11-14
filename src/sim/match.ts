// Runs a whole bot-versus-bot match with no rendering. Used by the balance script and tests.
import { CARD_IDS, type CardId } from './balance';
import { botDecide, createBot, type Difficulty } from './bot';
import { createState, step, type Command, type State } from './sim';

export interface MatchResult {
  state: State;
  /** How many times each side deployed each card. */
  plays: Record<CardId, [number, number]>;
}

export function runBotMatch(seed: number, left: Difficulty, right: Difficulty): MatchResult {
  const state = createState(seed);
  const bots = [createBot(left, 0, seed), createBot(right, 1, seed)] as const;
  const plays = Object.fromEntries(CARD_IDS.map((id) => [id, [0, 0]])) as Record<CardId, [number, number]>;
  while (state.winner === null) {
    const commands: Command[] = [];
    for (const bot of bots) {
      const cmd = botDecide(bot, state);
      if (cmd) {
        commands.push(cmd);
        plays[cmd.card][cmd.side]++;
      }
    }
    step(state, commands);
  }
  return { state, plays };
}
