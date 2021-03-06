

const processingFunctions = {
  convertIntegerNegative: number => number > 0 ? -Math.abs(number) : number,
  convertIntegersNegatives: numbers => {
    for (let [key, value] of Object.entries(numbers)) {
      numbers[key] = processingFunctions.convertIntegerNegative(value);
    }
    return numbers
  },
  findRepeatingField: trigger => trigger.split('_')[1],
  //Roll20 does not allow for Promises
  //getAttributes: array => new Promise((resolve, reject) => array ? getAttrs(array, v => resolve(v)) : reject(errorMessage('Function failed'))),
  getReprowid: trigger => {
    const split = trigger.split('_');
    return `${split[0]}_${split[1]}_${split[2]}`
  },
  getTranslations: translationKeys => {
    let translations = {}
    translationKeys.forEach(key => translations[`${key}`] = getTranslationByKey(key))
    return translations
  },
  parseInteger: string => parseInt(string) || 0,
  parseIntegers: numbers => {
    for (let [key, value] of Object.entries(numbers)) {
        numbers[key] = parseInt(value) || 0;
    }
    return numbers  
  },
  setAttributes: (update, silent) => silent && typeof update === 'object' ? setAttrs(update, {silent:true}) : typeof update === 'object' ? setAttrs(update) : console.error(`${update} is not an object`),
  sliceAttr: attribute => attribute.slice(2, -1), 
  sumIntegers: numbers => numbers.reduce((a,b) => a + b, 0),

  shadowrun: {
    addRepRow: (repRowID, attributeList) => {
      let weaponAttributeWithRepeatingRow = []
      attributeList.forEach(weaponAttribute => weaponAttributeWithRepeatingRow.push(`${repRowID}_${weaponAttribute}`))
      return weaponAttributeWithRepeatingRow
    },
    attributeFactory: attrs => {
      attrs = processingFunctions.shadowrun.findFlagInKeys(attrs) ? processingFunctions.shadowrun.processTempFlags(attrs) : attrs
      attrs = processingFunctions.parseIntegers(attrs)
      attrs = processingFunctions.shadowrun.calculateBonuses(attrs)
      attrs.total = processingFunctions.sumIntegers(Object.values(attrs))
      attrs.base = attrs.total - attrs.bonus
      return attrs
    },
    conditionFactory: attrs => {
      attrs.attribute = processingFunctions.shadowrun.determineConditionAttribute(attrs)
      attrs.base = processingFunctions.shadowrun.determineConditionBase(attrs.sheet_type, attrs.drone_flag)
      attrs.modifier = attrs[processingFunctions.shadowrun.findModifierInKeys(attrs)]
      Object.keys(attrs).forEach(key => !['attribute', 'base', 'modifier'].includes(key) ? delete attrs[key] : false)
      attrs = processingFunctions.parseIntegers(attrs)
      return attrs
    },
    contructRepeatingWeaponAttributes: (repRowID, type) => {
      const attributeList = processingFunctions.shadowrun.determineWeaponAttributesByType(type)
      const constructedWeaponAttributes = processingFunctions.shadowrun.addRepRow(repRowID, attributeList)
      return constructedWeaponAttributes
    },
    buildDisplay: (base, bonus) => bonus === 0 ? base : `${base} (${base + bonus})`,
    calculateBonuses: attrs => {
      attrs.bonus = 0
      for (let [key, value] of Object.entries(attrs)) { 
        if (key.includes('modifier') || key.includes('temp')) {
          attrs.bonus += value
          delete attrs[key]
        }
      }
      return attrs
    },
    calculateConditionTracks: conditionInts => Math.ceil(conditionInts.attribute/2) + conditionInts.base + conditionInts.modifier,
    calculateLimitTotal: attrs => Math.ceil((attrs[0] + attrs[1] + (attrs[2] * 2))/3),
    calculateRunSpeed: (agility, modifier) => (agility * 4) + modifier,
    calculateWalkSpeed:(agility, modifier) => (agility * 2) + modifier,
    calculateWounds: attrs => {
      const divisor  = attrs.low_pain_tolerance === 2 ? attrs.low_pain_tolerance : 3;
      const highPain = attrs.high_pain_tolerance >= 1 ? attrs.high_pain_tolerance : 0;
      let sum = 0;

      ["stun", "physical"].forEach(attr => {
        const damageCompensator = attrs[`damage_compensators_${attr}`] || 0
        let dividend = Math.max(attrs[`${attr}`] - (highPain + damageCompensator), 0)
        sum -= Math.floor(dividend / divisor) || 0
      })
      return sum
    },
    convertSkillSelectToHiddenSkill: skillName => {
      let skill = skillName.toLowerCase()
      skill = skill.includes('group') ? skill.slice(0, -6) : skill
      skill = skill.includes(" ") ? skill.replace(/ /g,"") : skill
      return skill
    },
    determineConditionBase: (type, drone) => drone ? 6 : type === 'vehicle' ? 12 : 8,
    determineConditionAttribute: attrs => attrs.willpower ? attrs.willpower : attrs.body ? attrs.body : attrs.device_rating ? attrs.device_rating : 0,
    determineWeaponAttributesByType: weaponType =>  weaponType === 'range' ? sheetAttributes.rangeAttributes : sheetAttributes.meleeAttribute,
    findFlagInKeys: attrs => Object.keys(attrs).find(key => key.includes('_flag')),
    findModifierInKeys: attrs => Object.keys(attrs).find(key => key.includes('_modifier')),
    processTempFlags: attrs => {
      try {
        const tempFlag = processingFunctions.shadowrun.findFlagInKeys(attrs)
        const attrName = tempFlag.split('_temp_flag')[0]
        attrs[`${tempFlag}`] === 'on' ? false : delete attrs[`${attrName}_temp`];
        delete attrs[`${tempFlag}`];
        return attrs
      } catch (error) {
        console.error(error)
      }
    },
    resetRepeatingFieldsPrimaries: (repeatingSection, repRowID) => {
      getSectionIDs(repeatingSection, ids => {
        let attributesWithIDs = [];
        let update = {};
        ids.forEach(id => attributesWithIDs.push(`${repeatingSection}_${id}_primary`))
        attributesWithIDs.forEach(attribute => !attribute.includes(repRowID) ? update[attribute] = 0 : false)
        setAttrs(update);
      })
    },
    shotsFired: (shots, trigger) => shots > 0 && trigger.includes('remove') ? shots -= 1 : trigger.includes('add') ? shots += 1 : shots,
    updateLimitTotal: attrs => {
      attrs.essence ? Math.ceil(attrs.essence) || 0 : false;
      return processingFunctions.shadowrun.calculateLimitTotal(Object.values(attrs))
    },
    resetPrimaryWeapon: type => {
      const resetPrimary = type === 'range' ? new PrimaryRangeWeapon(type) : new PrimaryMeleeWeapon(type)
      let update = {}
      for (let [key, value] of Object.entries(resetPrimary)) {
        update[key] = value
      }
      return update
    },
    updatePrimaryWeapons: attrs => {
      let update = {}
      for (let [key, value] of Object.entries(attrs)) {
        const type = processingFunctions.findRepeatingField(key)
        const getReprowid = processingFunctions.getReprowid(key)
        const weaponAttribute = key.split(`${getReprowid}_`)[1]
        const primaryAttributeName = key.includes('weapon') ? `primary_${type}_weapon` : `primary_${type}_weapon_${weaponAttribute}`
        update[primaryAttributeName] = value

        if (key.includes('ammo')) {
          update[`${primaryAttributeName}_max`] = value
        }
      }
      return update
    }
  }
}


//for Mocha Unit Texting
//module.exports = processingFunctions;

