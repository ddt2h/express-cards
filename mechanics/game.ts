import { User } from "../src/interfaces/user";
import { cardData } from "../src/interfaces/card";
import { State } from "../src/interfaces/state";
import { ActResponse } from "../src/interfaces/act.response";
import { TurnResponse } from "../src/interfaces/turn.response";
import { GetCardResponse } from "../src/interfaces/getcard.response";
import shuffleArray from "shuffle-array";
import assert from "assert";

export class Game {
    constructor() {

    }

    private generateDeck() {
        //ARRANGE RANDOMLY
        this.mainCardStack = [];
        let arr = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6];
        arr = shuffleArray(arr);
        for (let i = 0; i < arr.length; i++) {
            this.mainCardStack.push(arr[i]);
        }
    }

    private performNextTurn() {
        this.whoActedPrevId = this.whoActsId;
        this.whoActsId++;
        if (this.whoActsId >= this.users.length) {
            this.whoActsId = 0;
        }
    }

    public addUser(username: string) {
        const user: User = {
            name: username,
            cards: []
        }

        this.users.push(user);
    }

    public removeUser(username: string) {
        this.users = this.users.filter(obj => obj.name !== username);
    }

    public startGame() { //when all users are ready
        this.generateDeck();
    }

    public restartGame() {
        for (let i = 0; i < this.users.length; i++) {
            this.users[i].cards = [];
        }

        this.generateDeck();
        this.whoActsId = 0;
        this.whoActedPrevId = 0;
        this.latestAct = [];
        this.cardsOnTablePool = [];
    }

    public getCard(): GetCardResponse {
        if (!this.mainCardStack.length) {
            return { card: null, error: 'No cards left' };
        }
        //check if user === current
        if (this.users[this.whoActsId].cards.length >= this.DECK_LIM) {
            return { card: null, error: 'Already have max cards' };
        }
        this.users[this.whoActsId].cards.push(this.mainCardStack.pop() as number);

        return { card: 0, error: null };
    }

    public _act(cardsId: number[], markAs: number[]): ActResponse {
        //Errors

        //No cards
        if (!cardsId.length || !markAs.length) {
            return { isValid: false, error: 'No cards selected' };
        }

        //Too many cards
        if (cardsId.length > this.users[this.whoActsId].cards.length || markAs.length > this.users[this.whoActsId].cards.length) {
            return { isValid: false, error: 'You dont have these cards' };
        }

        //Users count < 2
        if (this.users.length < 2) {
            return { isValid: false, error: 'No users, cant act' };
        }

        //Validate cards
        for (let i = 0; i < cardsId.length; i++) {
            if (cardsId[i] >= this.users[this.whoActsId].cards.length) {
                return { isValid: false, error: 'You dont have these cards' };
            }
        }

        //Validate marking (all the same)
        let set = new Set(markAs);
        if (set.size > 1) {
            return { isValid: false, error: 'Cards marks are not the same value' };
        }

        //Validate reappearing ids
        let set2 = new Set(cardsId);
        if (set2.size < cardsId.length) {
            return { isValid: false, error: 'Cards ids are the same value' };
        }

        //Check if they are the same value as on the table
        if (this.cardsOnTablePool.length) {
            if (this.cardsOnTablePool[0].trustVal !== markAs[0]) {
                return { isValid: false, error: 'Cards are not the same as on the table' };
            }
        }

        //Push cards to the table
        cardsId.sort((a, b) => b - a);

        this.latestAct = [];

        for (let i = 0; i < cardsId.length; i++) {

            this.latestAct.push({ realVal: this.users[this.whoActsId].cards[cardsId[i]], trustVal: markAs[i] });

            this.cardsOnTablePool.push({
                realVal: this.users[this.whoActsId].cards[cardsId[i]],
                trustVal: markAs[i]
            });
            this.users[this.whoActsId].cards.splice(cardsId[i], 1);
        }

        this.performNextTurn();

        return { isValid: true, error: null };
    }

    public _turn(): TurnResponse {

        //
        if (!this.cardsOnTablePool.length) {
            return { isRight: null, error: 'Nothing on table' };
        }

        let right: boolean = true;

        //check truth
        for (let i = 0; i < this.latestAct.length; i++) {
            if (Number(this.latestAct[i].realVal) !== Number(this.latestAct[i].trustVal)) {
                right = false;
                break;
            }
        }


        let userId = right ? this.whoActsId : this.whoActedPrevId;
        for (let i = 0; i < this.cardsOnTablePool.length; i++) {
            this.users[userId].cards.push(this.cardsOnTablePool[i].realVal);
        }

        this.cardsOnTablePool = [];

        if (right) this.performNextTurn();

        return { isRight: right, error: null };
    }

    public getUserDeck(username: string): number[] {
        //
        let cards: number[] = [];
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].name === username) {

                for (let j = 0; j < this.users[i].cards.length; j++) {
                    cards.push(this.users[i].cards[j]);
                }
                return cards;
            }
        }
        return [];
    }

    public getCurrentUsername(): string {
        return this.users[this.whoActsId]?.name;
    }

    public getState(): State {
        const markedCards: number[] = this.cardsOnTablePool.map(card => card.trustVal);
        const users: string[] = this.users.map(username => username.name);
        const userCards: number[] = this.users.map(num => num.cards.length);
        return {
            remainingCards: this.mainCardStack.length, tableCards: markedCards,
            usernames: users, whoActsName: this.users[this.whoActsId]?.name, yourCards: null,
            readyCount: 0, usersCardsCount: userCards
        };
    }

    private users: User[] = [];
    private mainCardStack: number[] = [];
    private cardsOnTablePool: cardData[] = [];
    private latestAct: cardData[] = [];
    private whoActsId: number = 0;
    private whoActedPrevId: number = 0;
    private DECK_LIM: number = 6;
}