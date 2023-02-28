"use strict";
const Story = (function() {
    var logError = function(error) {
        console.error("[Story] "+error);
    };
    var logInfo = function(info) {
        console.info("[Story] "+info);
    };
    var createFromScriptUrl = function(scriptUrl) {
        return new Promise(function(resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open("GET", scriptUrl);
            xhr.onreadystatechange = function(){
                if (this.status == 200 && this.readyState == XMLHttpRequest.DONE) {
                    resolve(create(JSON.parse(this.response)));
                }
            };
            xhr.send();
        });
    };
    var create = function(scriptData) {
        var scenes = scriptData.scenes || [];
        var images = scriptData.images || [];
        var vars = scriptData.vars || {};
        var currentSceneId = 0;
        var currentReplyId = 0;
        var getState = function() {
            let choices = [];
            if (scenes[currentSceneId].choices && scenes[currentSceneId].replies.length-1 <= currentReplyId)
                for (let choice of scenes[currentSceneId].choices) {
                    if (testExpression(choice.condition))
                        choices.push(choice);
                }
            return {
                background: scenes[currentSceneId].background!==undefined ? images[scenes[currentSceneId].background] : undefined,
                text: scenes[currentSceneId].replies[currentReplyId].text,
                speaker: scenes[currentSceneId].replies[currentReplyId].speaker,
                color: scenes[currentSceneId].replies[currentReplyId].color,
                image: scenes[currentSceneId].replies[currentReplyId].image!==undefined ? images[scenes[currentSceneId].replies[currentReplyId].image] : undefined,
                choices: choices,
                vars: vars
            };
        };
        var calcExpression = function(value) {
            if (value.var) {
                if (!vars[value.var])
                    return void logError("Variable inexistante : "+value.var);
                if (vars[value.var].type!="int")
                    return void logError("Variable de type non-entier : "+value.var);
                return vars[value.var].value;
            }
            if (value.op) {
                switch(value.op) {
                    case "+":
                        return calcExpression(value.a) + calcExpression(value.b);
                    case "-":
                        return calcExpression(value.a) - calcExpression(value.b);
                    case "*":
                        return calcExpression(value.a) * calcExpression(value.b);
                    case "%":
                        return calcExpression(value.a) % calcExpression(value.b);
                    default:
                        return void logError("Opérateur arithmétique inconnu : "+value.op);
                }
            }
            return value;
        };
        var testExpression = function(condition) {
            if (condition===undefined) return true;
            if (condition.var) {
                if (!vars[condition.var])
                    return void logError("Variable inexistante : "+condition.var);
                if (vars[condition.var].type!="boolean")
                    return void logError("Variable de type non-booléen : "+condition.var);
                return vars[condition.var].value;
            }
            if (condition.op) {
                switch(condition.op) {
                    case "<":
                        return calcExpression(condition.a) < calcExpression(condition.b);
                    case ">":
                        return calcExpression(condition.a) > calcExpression(condition.b);
                    case "==":
                        return calcExpression(condition.a) == calcExpression(condition.b);
                    case "!=":
                        return calcExpression(condition.a) != calcExpression(condition.b);
                    case ">=":
                        return calcExpression(condition.a) >= calcExpression(condition.b);
                    case "<=":
                        return calcExpression(condition.a) <= calcExpression(condition.b);
                    case "!":
                        return !testExpression(condition.a);
                    case "&&":
                        return testExpression(condition.a) && testExpression(condition.b);
                    case "||":
                        return testExpression(condition.a) || testExpression(condition.b);
                    default:
                        return void logError("Opérateur de comparaison ou logique inconnu : "+condition.op);
                }
            }
            return condition;
        };
        var applyEffect = function(effect) {
            if (!effect) return;
            switch(effect.op) {
                case "set":
                    if (!vars[effect.a])
                        return void logError("Variable inexistante : "+effect.a);
                    if (vars[effect.a].type=="int")
                        vars[effect.a].value = calcExpression(effect.b);
                    else if (vars[effect.a].type=="boolean")
                        vars[effect.a].value = testExpression(effect.b);
                    else
                        logError("Type de variable non-mutable : "+vars[effect.a].type);
                    return;
                default:
                    return void logError("Opérateur d'effet inconnu : "+effect.op);
            }
        };
        var applyEffects = function(effects) {
            if (!effects) return;
            for (let effect of effects) applyEffect(effect);
        };
        var nextReply = function() {
            if (currentReplyId+1 < scenes[currentSceneId].replies.length) {
                currentReplyId++;
                console.log("effects at "+currentReplyId+" ? "+(!(!(scenes[currentSceneId].replies[currentReplyId].effects))));
                applyEffects(scenes[currentSceneId].replies[currentReplyId].effects);
            } else if (scenes[currentSceneId].atEnd == "redirect") {
                goToScene(scenes[currentSceneId].redirect);
                applyEffects(scenes[currentSceneId].replies[currentReplyId].effects);
            }
            return getState();
        };
        var goToScene = function(id) {
            currentSceneId = id;
            currentReplyId = 0;
        };
        var nextScene = function(choiceIndex=null) {
            let choices = [];
            for (let choice of scenes[currentSceneId].choices) {
                if (testExpression(choice.condition))
                    choices.push(choice);
            }
            if (choices.length == 0) {
                logInfo("Aucun choix possible OmG");
                return null;
            }
            if (choiceIndex == null) {
                let choice = choices[parseInt(Math.random()*choices.length)];
                applyEffect(choice.effect);
                goToScene(choice.id);
            } else {
                applyEffect(choices[choiceIndex].effect);
                goToScene(choices[choiceIndex].id);
            }
            return getState();
        };
        return {
            nextReply: nextReply,
            nextScene: nextScene,
            getState: getState
        };
    };
    return {
        create:create,
        createFromScriptUrl:createFromScriptUrl
    };
})();

const StoryDisplayer = (function() {
    var create = function(storyDiv_, story_, fullscreen=false) {
        var storyDiv = storyDiv_;
        var story = story_;
        var debug = false;
        var displayState = function(state) {
            storyDiv.style.backgroundImage = state.background ? "url('"+state.background+"')" : "";
            storyDiv.getElementsByClassName("speech")[0].innerText = state.text || "";
            storyDiv.getElementsByClassName("speaker")[0].innerText = state.speaker || "";
            storyDiv.getElementsByClassName("speaker")[0].style.backgroundColor = state.color || "";
            storyDiv.getElementsByClassName("speaker")[0].style.display = (state.speaker) ? "" : "none";
            let oldImageC = storyDiv.getElementsByClassName("image")[0];
            if ((oldImageC==undefined&&state.image)||(oldImageC!=undefined && (!oldImageC.style.backgroundImage.includes(state.image)))) {
                if (oldImageC) {
                    oldImageC.style.opacity = 0;
                    oldImageC.className = "old-image";
                    setTimeout(function() {
                        if (oldImageC.parentElement && oldImageC.style.backgroundImage!="url('"+state.image+"')")
                            oldImageC.parentElement.removeChild(oldImageC);
                    }, 1000*parseFloat(getComputedStyle(oldImageC).transitionDuration.match(/([0-9]*\.[0-9]+|[0-9]+)/)[0]));
                }
                if (state.image) {
                    let newImageC = createElement("div", {className:"image", style:{backgroundImage:"url('"+state.image+"')"}});
                    storyDiv.getElementsByClassName("images")[0].appendChild(newImageC);
                    getComputedStyle(newImageC).opacity; // force reflow
                    newImageC.style.opacity = 1;
                }
            }
            let choicesUl = storyDiv.getElementsByClassName("choices")[0];
            choicesUl.innerHTML = "";
            choicesUl.style.display = state.choices && state.choices.length > 0 ? "" : "none";
            if (state.choices)
                for (let choice of state.choices) {
                    let choiceIndex = state.choices.indexOf(choice);
                    choicesUl.appendChild(createElement("li", {}, choice.text, {click:function(e){
                        if (story)
                            displayState(story.nextScene(choiceIndex));
                        e.stopPropagation();
                    }}));
                }
            refreshVars(state.vars||{});
            return true;
        };
        var refreshVars = function(vars) {
            var varsDiv = storyDiv.getElementsByClassName("vars")[0];
            for (const [name,variable] of Object.entries(vars)) {
                if (variable.public) {
                    let varDiv = varsDiv.getElementsByClassName("var-"+name)[0];
                    if (varDiv)
                        varDiv.children[0].children[0].style.height = variable.value/variable.max*100+"%";
                    else varsDiv.appendChild(createElement("div", {className:"var-"+name}, [
                        createElement("div", {}, [
                            createElement("div", {style:{backgroundColor:variable.color,height:variable.value/variable.max*100+"%"}})
                        ]),
                        createElement("span", {}, name)
                    ]));
                }
            }
            for (const [name,variable] of Object.entries(vars)) {
                if (!variable.public) {
                    let varDiv = varsDiv.getElementsByClassName("var-"+name)[0];
                    if (varDiv) {
                        if (debug)
                            varDiv.innerText = name+" : "+variable.value;
                        else varDiv.parentElement.removeChild(varDiv);
                    } else if (debug) {
                        varsDiv.appendChild(createElement("span", {className:"var-"+name}, name+" : "+variable.value));
                    }
                }
            }
        };
        // init
        storyDiv.classList.add("story");
        storyDiv.appendChild(createElement("div", {className:"images"}));
        storyDiv.appendChild(createElement("ul", {className:"choices"}));
        storyDiv.appendChild(createElement("fieldset", {className:"speech-zone"}, [
            createElement("legend", {className:"speaker"}),
            createElement("span", {className:"speech"})
        ]));
        storyDiv.appendChild(createElement("div", {className:"vars"}));
        storyDiv.addEventListener("click", function() {
            if (!story) return;
            let state = story.nextReply();
            if (state) displayState(state);
        });
        storyDiv.tabIndex = 0;
        storyDiv.addEventListener("keypress", function(e) {
            if(e.keyCode==68 && e.shiftKey) {
                debug = !debug;
                if (story) displayState(story.getState());
            }
        });
        if (story)
            displayState(story.getState());
        if (fullscreen) {
            let fullscreenButton = createElement("img", {src:"fullscreen.svg", className:"fullscreen-button"}, [], {click:function(){
                storyDiv.requestFullscreen();
            }});
            storyDiv.appendChild(fullscreenButton);
            document.addEventListener("fullscreenchange", function() {
                fullscreenButton.style.display = document.fullscreenElement==storyDiv ? "none" : "";
            });
        }
        return {
            displayState: displayState
        };
    };
    return {
        create: create
    };
})();

// fonction utile d'Ambi
function createElement(tag, properties={}, inner=[], eventListeners={}) {
    let el = document.createElement(tag);
    for (let p of Object.keys(properties)) if (p != "style") el[p] = properties[p];
    if (properties.style) for (let p of Object.keys(properties.style)) el.style[p] = properties.style[p];
    if (properties.dataset) for (let p of Object.keys(properties.dataset)) el.dataset[p] = properties.dataset[p];
    if (typeof inner == "object") for (let i of inner) el.appendChild(typeof i == "string" ? document.createTextNode(i) : i);
    else el.innerText = inner;
    for (let l of Object.keys(eventListeners)) el.addEventListener(l, eventListeners[l]);
    return el;
}