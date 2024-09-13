export interface State {
    remainingCards: number,
    tableCards: number[],
    yourCards: number[] | null,
    usernames: string[],
    usersCardsCount: number[],
    whoActsName: string,
    readyCount: number
}