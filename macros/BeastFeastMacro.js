// Beast Feast Dice Roller for Daggerheart in Foundry VTT

class BeastFeastRoller {
    constructor() {
        this.diceTypes = {
            'sweet': 4,
            'salty': 6,
            'bitter': 8,
            'sour': 10,
            'savory': 12,
            'weird': 20
        };
        this.currentDice = [];
        this.matchedValues = [];
        this.token = 0;
    }

    // Helper to roll a die
    rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    // Helper to roll all dice in the pool
    rollDicePool(dicePool) {
        for (let die of dicePool) {
            die.value = this.rollDie(die.sides);
        }
        return dicePool;
    }

    // Helper to display current dice
    displayDice(dicePool) {
        if (!dicePool.length) {
            return "No dice left.";
        }
        
        const grouped = {};
        for (let die of dicePool) {
            if (!grouped[die.flavor]) grouped[die.flavor] = [];
            grouped[die.flavor].push(die.value);
        }
        
        let result = "";
        for (let [flavor, rolls] of Object.entries(grouped)) {
            result += `${flavor.charAt(0).toUpperCase() + flavor.slice(1)} rolls (d${this.diceTypes[flavor]}): [${rolls.join(', ')}]\n`;
        }
        return result;
    }

    // Helper to find duplicates
    findDuplicates(dicePool) {
        const valueCounts = {};
        for (let die of dicePool) {
            valueCounts[die.value] = (valueCounts[die.value] || 0) + 1;
        }
        
        const duplicates = {};
        for (let [value, count] of Object.entries(valueCounts)) {
            if (count > 1) {
                duplicates[parseInt(value)] = count;
            }
        }
        return duplicates;
    }

    // Helper to get dice without values in a set
    diceWithoutValues(dicePool, values) {
        const valueSet = new Set(values);
        return dicePool.filter(die => !valueSet.has(die.value));
    }

    // Main rolling function
    async startRolling(flavorCounts, tokenValue = 0) {
        // Build the dice pool
        const dicePool = [];
        let idx = 0;
        
        for (let [flavor, count] of Object.entries(flavorCounts)) {
            const sides = this.diceTypes[flavor];
            for (let i = 0; i < count; i++) {
                dicePool.push({
                    flavor: flavor,
                    sides: sides,
                    idx: idx++,
                    value: null
                });
            }
        }

        if (!dicePool.length) {
            ui.notifications.warn("No dice to roll.");
            return;
        }

        this.currentDice = dicePool;
        this.matchedValues = [];
        this.token = tokenValue;
        
        // Roll all dice
        this.rollDicePool(this.currentDice);
        
        let content = `<h3>Beast Feast Dice Roller</h3>`;
        content += `<p><strong>Rolling the dice:</strong></p>`;
        content += `<pre>${this.displayDice(this.currentDice)}</pre>`;
        
        await this.proceedLogic(content);
    }

    // Logic to proceed after each roll
    async proceedLogic(previousContent = "") {
        const duplicates = this.findDuplicates(this.currentDice);
        let content = previousContent;

        if (this.currentDice.length === 1) {
            const lastDie = this.currentDice[0];
            content += `<p><strong>Only one die left:</strong> ${lastDie.flavor.charAt(0).toUpperCase() + lastDie.flavor.slice(1)} (d${lastDie.sides}) rolled ${lastDie.value}. Done!</p>`;
            
            if (this.matchedValues.length > 0) {
                const uniqueVals = [...new Set(this.matchedValues)].sort((a, b) => a - b);
                const grandTotal = uniqueVals.reduce((sum, val) => sum + val, 0);
                const detail = uniqueVals.join(' + ');
                content += `<p><strong>Grand total of unique matched values:</strong> ${detail} = ${grandTotal}</p>`;
            }
            
            this.showResults(content);
            return;
        }

        if (Object.keys(duplicates).length === 0) {
            content += `<p><strong>No values appeared more than once across all rolls.</strong></p>`;
            await this.showRemoveOptions(content);
        } else {
            content += `<p><strong>Recap of values that appeared more than once:</strong></p>`;
            for (let [value, count] of Object.entries(duplicates)) {
                const flavors = this.currentDice
                    .filter(die => die.value == value)
                    .map(die => die.flavor.charAt(0).toUpperCase() + die.flavor.slice(1));
                const uniqueFlavors = [...new Set(flavors)];
                content += `<p>Value ${value} appeared ${count} times. Occurs in: ${uniqueFlavors.join(', ')}</p>`;
            }

            // Save matched values
            for (let value of Object.keys(duplicates)) {
                const val = parseInt(value);
                if (!this.matchedValues.includes(val)) {
                    this.matchedValues.push(val);
                }
            }

            // Remove matched dice
            const matchedSet = Object.keys(duplicates).map(v => parseInt(v));
            const remaining = this.diceWithoutValues(this.currentDice, matchedSet);

            if (remaining.length === 0) {
                content += `<p><strong>All dice matched and are removed. Done!</strong></p>`;
                if (this.matchedValues.length > 0) {
                    const uniqueVals = [...new Set(this.matchedValues)].sort((a, b) => a - b);
                    const grandTotal = uniqueVals.reduce((sum, val) => sum + val, 0);
                    const detail = uniqueVals.join(' + ');
                    content += `<p><strong>Grand total of unique matched values:</strong> ${detail} = ${grandTotal}</p>`;
                }
                this.showResults(content);
                return;
            }

            content += `<p><strong>${remaining.length} dice remain after removing matches.</strong></p>`;
            await this.showRerollOption(content, remaining);
        }
    }

    async showRemoveOptions(content) {
        const options = this.currentDice.map((die, index) => 
            `<option value="die-${die.idx}">${die.flavor.charAt(0).toUpperCase() + die.flavor.slice(1)} (d${die.sides}) rolled ${die.value}</option>`
        ).join('');
        
        let tokenOption = '';
        if (this.token > 0) {
            tokenOption = `<option value="token">Token (${this.token})</option>`;
        }

        content += `
            <div style="margin: 10px 0;">
                <label for="remove-select">Remove: </label>
                <select id="remove-select">
                    ${options}
                    ${tokenOption}
                </select>
                <button id="remove-btn" style="margin-left: 10px;">Remove and Reroll</button>
            </div>
        `;

        const dialog = new Dialog({
            title: "Beast Feast Dice Roller",
            content: content,
            buttons: {},
            render: (html) => {
                html.find('#remove-btn').click(async () => {
                    const selected = html.find('#remove-select').val();
                    
                    if (selected.startsWith('die-')) {
                        const idx = parseInt(selected.split('-')[1]);
                        this.currentDice = this.currentDice.filter(die => die.idx !== idx);
                    } else if (selected === 'token') {
                        this.token = Math.max(0, this.token - 1);
                    }

                    this.rollDicePool(this.currentDice);
                    dialog.close();
                    
                    let newContent = content.split('<div style="margin: 10px 0;">')[0];
                    newContent += `<p><strong>After removing and rerolling:</strong></p>`;
                    newContent += `<pre>${this.displayDice(this.currentDice)}</pre>`;
                    
                    await this.proceedLogic(newContent);
                });
            }
        });
        dialog.render(true);
    }

    async showRerollOption(content, remaining) {
        content += `<button id="reroll-btn">Reroll Remaining</button>`;

        const dialog = new Dialog({
            title: "Beast Feast Dice Roller",
            content: content,
            buttons: {},
            render: (html) => {
                html.find('#reroll-btn').click(async () => {
                    this.currentDice = remaining;
                    this.rollDicePool(this.currentDice);
                    dialog.close();
                    
                    let newContent = content.split('<button')[0];
                    newContent += `<p><strong>After rerolling remaining dice:</strong></p>`;
                    newContent += `<pre>${this.displayDice(this.currentDice)}</pre>`;
                    
                    await this.proceedLogic(newContent);
                });
            }
        });
        dialog.render(true);
    }

    showResults(content) {
        content += `<button onclick="game.beastFeast.showInputDialog()">Roll Again</button>`;
        
        new Dialog({
            title: "Beast Feast Dice Roller - Results",
            content: content,
            buttons: {
                close: {
                    label: "Close"
                }
            }
        }).render(true);
    }

    showInputDialog() {
        const flavorInputs = Object.keys(this.diceTypes).map(flavor => 
            `<div style="margin: 5px 0;">
                <label for="${flavor}">${flavor.charAt(0).toUpperCase() + flavor.slice(1)} (d${this.diceTypes[flavor]}): </label>
                <input type="number" id="${flavor}" min="0" value="0" style="width: 60px;">
            </div>`
        ).join('');

        const content = `
            <div>
                <h3>Enter your dice:</h3>
                ${flavorInputs}
                <div style="margin: 5px 0;">
                    <label for="token">Token: </label>
                    <input type="number" id="token" min="0" value="0" style="width: 60px;">
                </div>
            </div>
        `;

        new Dialog({
            title: "Beast Feast Dice Roller",
            content: content,
            buttons: {
                roll: {
                    label: "Roll Dice",
                    callback: (html) => {
                        const flavorCounts = {};
                        for (let flavor of Object.keys(this.diceTypes)) {
                            flavorCounts[flavor] = parseInt(html.find(`#${flavor}`).val()) || 0;
                        }
                        const tokenValue = parseInt(html.find('#token').val()) || 0;
                        this.startRolling(flavorCounts, tokenValue);
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }
}

// Initialize the roller
Hooks.once('ready', () => {
    game.beastFeast = new BeastFeastRoller();
    
    // Add a macro button or chat command
    ui.notifications.info("Beast Feast Dice Roller loaded! Use game.beastFeast.showInputDialog() to start rolling.");
});

// Optional: Create a macro
// You can create a macro in Foundry with this content:
// game.beastFeast.showInputDialog();