//=============================================================================
// KC Library - Core
// KCL_Core.js
// Version: 1.00
//=============================================================================

var KCL = KCL || {};
KCL.Battle = KCL.Battle || {};

//=============================================================================
 /*:
 * @plugindesc This plugin defines a common set of battle related functions
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * Not much to see here.
 *
 */
//=============================================================================

KCL.Battle._formulary = 'log';

KCL.Battle.attackDamage = function(a, b, potency) {

	switch (KCL.Battle._formulary) {
		case 'basic': {
			potency = potency||4;
			return a.atk * potency - b.def * 2;
		}
		case 'log': {
			potency = potency||4;
			baseAttack = (a.atk*potency)/4;
			return (baseAttack) * Math.log10(baseAttack) * Math.log(1 + Math.pow((a.atk / b.def), 2)) / Math.log(2);
		}
	}
}

KCL.Battle.magicDamage = function(a, b, potency) {
	switch (KCL.Battle._formulary) {
		case 'basic': {
			potency = potency||100;
			return potency + a.mat * 2 - b.mdf * 2;
		}
		case 'log': {
			potency = potency||100;
			return ((a.mat*potency)/100) * Math.log10(a.mat) * Math.log(1 + Math.pow((a.mat / b.mdf), 2)) / Math.log(2);
		}
	}
}

KCL.Battle.healDamage = function(a, potency) {
	switch (KCL.Battle._formulary) {
		case 'basic': {
			potency = potency||100;
			return a.mat + potency;
		}
		case 'log': {
			potency = potency||100;
			return a.mat + potency;
		}
	}
}