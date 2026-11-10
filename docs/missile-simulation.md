# Project Apex missile simulation

The shared profiles in [missile-data.js](../web/missile-data.js) drive the native flight and launch window, the in-flight models, and the exhaust timing. The maximum column is the upper bound configured in the game. Lower launch or target altitude, lower launch speed and a receding target shorten the firing window. IR acquisition and radar tracking, angular limits, and semi-active illumination apply separately. The HUD shows the computed upper end of the current firing window.

| Missile | Game ceiling (km) | Warhead mass (kg) | Basis for the profile |
| --- | ---: | ---: | --- |
| AIM-9J / AIM-9P | 18 / 18 | 4.5 | AIM-9J/N public summary. P uses the family figure with a larger rear engagement window. [USAF](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104557/aim-9-sidewinder/) · [Designation Systems](https://www.designation-systems.net/dusrm/m-9.html) |
| AIM-9M | 29 | 9.4 | Rounded upper end of NAVAIR's 10–18 mi figure. [NAVAIR](https://www.navair.navy.mil/product/AIM-9M-Sidewinder) · [Warhead reference](https://www.designation-systems.net/dusrm/m-9.html) |
| AIM-9X | 32 | 9.4 | NAVAIR lists classified range and a common warhead with the 9M. The range is a game estimate. [NAVAIR](https://www.navair.navy.mil/product/AIM-9X-Sidewinder) |
| R-60M | 8 | 3.5 | Maximum launch distance in the R-60M catalogue. It also lists a 3–5 s motor burn. [RWD technical catalogue](https://www.rwd-mb3.de/ftechnik/pages/aa8.htm) |
| R-73 | 20 / 30 | 7.4 | RMD-1 envelope for the MiG-29 and later RMD-2 envelope for the Su-35S. [UK MOD field manual](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/455023/1996_AFM_Vol_2_Gen_En_Mob_Pt_2_OET.pdf) |
| R-74M2 | 35 | 7.4 | R-73-derived game estimate for the Su-57's short-range loadout. [Variant reference](https://www.twz.com/air/we-finally-get-a-clear-look-at-the-su-57-felons-side-weapons-bays) |
| AIM-7E-2 | 30 | 30.3 | AIM-7E family envelope and Mk 38 expanding-rod warhead. [NAVAIR](https://www.navair.navy.mil/product/Air-Intercept-Missile-AIM-7-Sparrow) · [USAF weapons file](https://www.bulletpicker.com/pdf/Weapons-File-1984.pdf) |
| AIM-120C | 105 | 18 | The game uses a C-5-based profile for its C-family stores. Range and warhead figures are open-source estimates. [NAVAIR](https://www.navair.navy.mil/product/AMRAAM) · [USAF motor description](https://www.acc.af.mil/Portals/92/Docs/Fact%20Sheets%20-%202020%20Update/Facts%20Sheets%202022%20Final/AIM-120_final.pdf) · [Open-source figures](https://www.designation-systems.net/dusrm/m-120.html) |
| AIM-54C | 150 | 60 | NAVAIR's specific AIM-54C entry. [NAVAIR](https://www.navair.navy.mil/node/12701) |
| R-24R | 50 | 25 | R-24R catalogue data with 45 s guided flight. [RWD technical catalogue](https://www.rwd-mb3.de/ftechnik/pages/r24r.htm) |
| R-27R | 60 | 39 | R-27R1 export figures give 60 km head-on and 18 km tail-on. [SpetsTechnoExport](https://www.spetstechnoexport.com/storage/files/ed7cd1c6642c6299a40c00e2770de4a5.pdf) · [Warhead reference](https://www.armyrecognition.com/archives/archives-aerospace-defense/aerospace-defense-2021/russian-r-27-air-to-air-missiles-to-rejoin-global-market) |
| R-77-1 | 110 | 22.5 | Export RVV-SD reference gives a single-mode motor and laser proximity sensor. [Rosoboronexport](https://roe.ru/pdfs/pdf_4710.pdf) |
| R-77M | 135 | 22.5 | Game estimate based on the RVV-SD profile with a longer sustain phase. |

Motor thrust, burn phases without public figures, drag and fuze radii are simulation estimates. Thrust is converted to acceleration with the missile's launch mass. Warhead assembly mass controls relative effect strength and is separate from explosive filler mass.

Once armed, a missile can burst at its closest pass by a live target part during a simulation tick. The fuze uses the target's motion and oriented part bounds, with the same geometry used for direct hits. The native damage calculation applies a contact loss to the struck part and applies shorter-range pressure and directional fragmentation to neighboring parts. Damage follows aircraft protection and cumulative part failure. The dedicated ground SAM encounter applies the localized warhead damage calculation behind its mission fuze.

The regression suite exercises gun impact energy, ammunition and reload, laser designation and bomb release, countermeasures, native flight, direct and proximity hits, and long-range radar engagements. The existing bomb classes follow the Mk 82/83/84 size classes and separate JDAM GPS/INS, Paveway laser guidance and unguided Mk 82 release. [USAF JDAM fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104572/joint-direct-attack-munition-gbu-313238/) · [NAVAIR direct attack weapons](https://www.navair.navy.mil/product/Direct-Attack-Weapons)
