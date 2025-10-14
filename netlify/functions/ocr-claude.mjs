// netlify/functions/ocr-claude.mjs
// Função OCR usando Claude 3.5 Haiku para o projeto Parabrisas
// Substitui o Google Cloud Vision OCR

import Anthropic from '@anthropic-ai/sdk';
// ===== MAPEAMENTO DE EUROCODES (INLINE) =====
const EUROCODE_PREFIX_MAP = {
  '1000': { marca: 'VLE AUTO', modelo: null },
  '1040': { marca: 'VLE MAQUINA', modelo: null },
  '1144': { marca: 'MG MG', modelo: '4 5P HK' },
  '1254': { marca: 'VLE MAQUINA', modelo: null },
  '1449': { marca: 'VLE TRACTOR', modelo: null },
  '1461': { marca: 'PBE MAQUINA', modelo: null },
  '1527': { marca: 'TESLA', modelo: '3 4P' },
  '2039': { marca: 'ALFA ROMEO', modelo: '159' },
  '2048': { marca: 'ALFA', modelo: 'ROMEO GIULIA 4P' },
  '2076': { marca: 'MERCEDES CLAS', modelo: 'E' },
  '2250': { marca: 'MG', modelo: 'HS 5P' },
  '2255': { marca: 'MG', modelo: 'MG4 5P HK' },
  '2301': { marca: 'BMW', modelo: 'SER 4 G26 4P' },
  '2302': { marca: 'BMW', modelo: 'SER 2 ACTIVE TOURER MPV' },
  '2303': { marca: 'BMW X', modelo: '1/IX1 U11' },
  '2306': { marca: 'BMW', modelo: 'SERIE 5' },
  '2431': { marca: 'BMW E', modelo: '36' },
  '2432': { marca: 'BMW E', modelo: '36' },
  '2433': { marca: 'BMW', modelo: 'SERIE 7' },
  '2434': { marca: 'BMW SERIE', modelo: '5 E39' },
  '2435': { marca: 'BMW Z', modelo: '3 2P' },
  '2436': { marca: 'BMW SERIE', modelo: '3 E46' },
  '2437': { marca: 'BMW SERIE', modelo: '3 E46' },
  '2439': { marca: 'BMW', modelo: 'X5 E53' },
  '2440': { marca: 'BMW NEW', modelo: 'MINI' },
  '2442': { marca: 'VQL BMW', modelo: 'E46 COMPACT' },
  '2443': { marca: 'BMW SERIE', modelo: '7 E65' },
  '2445': { marca: 'BMW SER', modelo: '5 (E60)' },
  '2447': { marca: 'BMW SER', modelo: '-3 (E90/E91)' },
  '2448': { marca: 'BMW', modelo: 'SERIE 1' },
  '2449': { marca: 'BMW', modelo: 'X3' },
  '2450': { marca: 'BMW SER', modelo: '3' },
  '2452': { marca: 'BMW', modelo: 'X5 5P' },
  '2454': { marca: 'BMW SERIE', modelo: '3 E92' },
  '2455': { marca: 'BMW MINI', modelo: 'CLUBMAN' },
  '2459': { marca: 'BMW SERIE', modelo: '5 F10/F11 4P' },
  '2460': { marca: 'BMW X', modelo: '1' },
  '2461': { marca: 'BMW', modelo: 'SERIE 5 GT (F07) 5P' },
  '2462': { marca: 'BMW', modelo: 'MINI COUNTRYMAN/PACEMAN 3/5P' },
  '2464': { marca: 'B X', modelo: '3 F25' },
  '2465': { marca: 'BMW SERIE', modelo: '3 4P' },
  '2466': { marca: 'BMW', modelo: 'MINI' },
  '2467': { marca: 'BMW', modelo: 'SERIE 1' },
  '2468': { marca: 'BMW', modelo: 'X4' },
  '2470': { marca: 'BMW', modelo: null },
  '2471': { marca: 'BMW SER', modelo: '4 F32 2P' },
  '2473': { marca: 'BMW X', modelo: '5 F15 5P' },
  '2474': { marca: 'BMW MINI', modelo: 'F56 3P HK' },
  '2475': { marca: 'BMW', modelo: 'SERIE 4 F33 2P' },
  '2477': { marca: 'BMW SERIE', modelo: '2 ACTIVE TOURER F45 5P HK' },
  '2479': { marca: 'BMW SERIE', modelo: '2 GRAN TOURER F46 MVM' },
  '2480': { marca: 'BMW', modelo: 'X2 XCITE F39 5P' },
  '2482': { marca: 'BMW X', modelo: '1' },
  '2483': { marca: 'BMW MINI', modelo: 'CLUBMAN 6P' },
  '2484': { marca: 'BMW', modelo: 'MINI COUNTRYMAN F60' },
  '2485': { marca: 'BMW SR', modelo: '5 G30/31 4P' },
  '2486': { marca: 'BMW', modelo: 'SER 6 GT G32' },
  '2487': { marca: 'BMW', modelo: 'X3 5P' },
  '2488': { marca: 'BMW', modelo: 'X4 5P' },
  '2489': { marca: 'BMW', modelo: 'Z4 G29 2D' },
  '2490': { marca: 'B SR', modelo: '3 4P' },
  '2496': { marca: 'BMW', modelo: 'SER 1 5P HK F40' },
  '2497': { marca: 'BMW', modelo: 'SER 2 4P GRN' },
  '2498': { marca: 'BMW', modelo: 'X6 G06 5P' },
  '2513': { marca: 'BEDFORD', modelo: 'RASCAL/SUZUKI CARRY' },
  '2715': { marca: 'CITROEN', modelo: 'BX 5P HK' },
  '2717': { marca: 'CITROEN AX', modelo: '3/5P' },
  '2721': { marca: 'CIT EVAS', modelo: '/JUMPY/FI ULYS/SCUD/PEUG 806/EXPER' },
  '2723': { marca: 'PEUGEOT', modelo: '106 RESTYLING/SAXO' },
  '2724': { marca: 'CITROEN BERLINGO', modelo: null },
  '2725': { marca: 'CITROEN XSARA', modelo: null },
  '2726': { marca: 'CITROEN C', modelo: '3' },
  '2727': { marca: 'CITROEN C', modelo: '5' },
  '2729': { marca: 'CITROEN XSARA', modelo: 'PICASSO' },
  '2731': { marca: 'CITROEN C', modelo: '2' },
  '2732': { marca: 'CITROEN C', modelo: '4 3P' },
  '2733': { marca: 'CITROEN', modelo: 'C6 4P' },
  '2734': { marca: 'CITROEN C', modelo: '1 5P' },
  '2735': { marca: 'CITROEN C', modelo: '4 PICASSO 5P' },
  '2737': { marca: 'CIT', modelo: 'JUMPER/FIAT DUCATO/PEUG BOXER' },
  '2739': { marca: 'CITROEN NEMO', modelo: 'VAN' },
  '2740': { marca: 'CITROEN C', modelo: '5' },
  '2741': { marca: 'PEUGEOT', modelo: 'PARTNER/BERLINGO' },
  '2743': { marca: 'CITROEN', modelo: 'C3 II 5P' },
  '2746': { marca: 'CITROEN', modelo: 'C4 5P HK' },
  '2752': { marca: 'CITROEN', modelo: 'C-ELYSEE/PEUGEOT 301 4P' },
  '2753': { marca: 'CITROEN', modelo: 'C4 PICAS/GRD C4 PIC' },
  '2754': { marca: 'CITROEN', modelo: 'C1/PEUGEOT 108/TOYOTA AYGO 3/5P HK/' },
  '2755': { marca: 'CITROEN C', modelo: '4 CACTUS 5P' },
  '2756': { marca: 'JMPY', modelo: '/SPCTR/TRVLLR/EXPRT/PROAC/VRSO' },
  '2758': { marca: 'CITROEN', modelo: 'C3 B618 5P HK S/TECTO' },
  '2761': { marca: 'CITROEN C', modelo: '5 AIRCROSS 5P' },
  '2763': { marca: 'C', modelo: 'BERLINGO' },
  '2765': { marca: 'CITROEN', modelo: 'C4 5P' },
  '2766': { marca: 'CITROEN', modelo: 'AMI' },
  '2768': { marca: 'C', modelo: 'C5X CRSSVR/DS4 CRSSVR' },
  '2770': { marca: 'CIT', modelo: 'C3 5P HK/AIRCROSS CC21' },
  '3022': { marca: 'CHEVROLET AVEO', modelo: '4P SAL' },
  '3024': { marca: 'CHEVROLET', modelo: 'CAPTIVA' },
  '3031': { marca: 'CHEVROLET', modelo: '/DAEW00 AVEO 5P HK/4P' },
  '3333': { marca: 'FIAT', modelo: 'PANDA 3P HK' },
  '3335': { marca: 'FIAT', modelo: null },
  '3337': { marca: 'FIAT', modelo: 'TIPO/FIAT TEMPRA' },
  '3341': { marca: 'FIAT PUNTO', modelo: null },
  '3348': { marca: 'FIAT BRAVO', modelo: '/BRAVA' },
  '3349': { marca: 'FIAT', modelo: 'PALIO/STRADA' },
  '3350': { marca: 'VQL FIAT', modelo: 'SEICENTO 3P' },
  '3351': { marca: 'FIAT', modelo: 'PUNTO 2' },
  '3352': { marca: 'FIAT', modelo: 'MULTIPLA MV' },
  '3354': { marca: 'FIAT DOBLO', modelo: null },
  '3355': { marca: 'VQL FIAT', modelo: 'STILO 5P' },
  '3358': { marca: 'FIAT', modelo: 'IDEA/LANCIA MUSA' },
  '3359': { marca: 'FIAT', modelo: 'PANDA' },
  '3360': { marca: 'FIAT', modelo: 'FIORINO QUBO/BEEPER/NEMO' },
  '3362': { marca: 'FIAT', modelo: 'GRDE PUNTO/PUNTO EVO/PUNTO 3/5P HK' },
  '3365': { marca: 'FIAT', modelo: 'BRAVO' },
  '3366': { marca: 'FIAT', modelo: '500 2P' },
  '3367': { marca: 'FIAT', modelo: '500 II 2P' },
  '3369': { marca: 'FIAT', modelo: 'DOBLO/OPEL COMBO' },
  '3372': { marca: 'FIAT', modelo: 'PANDA 5P HK' },
  '3373': { marca: 'F', modelo: null },
  '3374': { marca: 'FIAT', modelo: '500X 5P' },
  '3375': { marca: 'FIAT TIPO', modelo: '4P' },
  '3544': { marca: 'FORD', modelo: 'FIESTA 5P' },
  '3546': { marca: 'FORD', modelo: 'MONDEO' },
  '3550': { marca: 'FO GALAXY', modelo: null },
  '3552': { marca: 'FORD FIESTA', modelo: null },
  '3556': { marca: 'FORD FOCUS', modelo: null },
  '3559': { marca: 'FORD', modelo: 'MONDEO' },
  '3562': { marca: 'FORD', modelo: 'FIESTA 5P' },
  '3565': { marca: 'FORD', modelo: 'C-MAX MV' },
  '3566': { marca: 'FORD FOCUS', modelo: 'HK/BK/SD' },
  '3567': { marca: 'FORD', modelo: 'GALAXY MV' },
  '3568': { marca: 'FORD S', modelo: '-MAX' },
  '3569': { marca: 'FORD', modelo: 'MONDEO 4P' },
  '3572': { marca: 'FORD FIESTA', modelo: 'VI 3/5P HK' },
  '3578': { marca: 'FORD FOCUS', modelo: '5P' },
  '3580': { marca: 'FORD', modelo: 'B-MAX MVM' },
  '3583': { marca: 'VQL FORD', modelo: 'ECOSPORT B515 5P' },
  '3587': { marca: 'FORD', modelo: 'GALAXY MPV' },
  '3590': { marca: 'FORD', modelo: 'KA 5P HK' },
  '3592': { marca: 'F', modelo: 'FIESTA 3/5P HK VII' },
  '3593': { marca: 'FORD', modelo: 'FOCUS 5P HK/WAGON' },
  '3594': { marca: 'FORD', modelo: 'KUGA 5P' },
  '3595': { marca: 'FORD', modelo: 'PUMA 5P' },
  '3727': { marca: 'FIAT DUCATO', modelo: 'VAN' },
  '3731': { marca: 'FORD TRANSIT', modelo: null },
  '3732': { marca: 'VLC IVECO', modelo: 'EUROCARGO/EUROTECH' },
  '3733': { marca: 'PBC IVECO', modelo: 'EUROSTAR/STRALIS/CURSOR' },
  '3734': { marca: 'FR IVECO', modelo: 'EUROTECH' },
  '3735': { marca: 'FIAT', modelo: 'DUCATO/CITROEN JUMPER/PEUG BOXER' },
  '3739': { marca: 'FORD TRANSIT', modelo: null },
  '3741': { marca: 'IVECO DAILY', modelo: 'II CREW' },
  '3743': { marca: 'FORD TORNEO', modelo: 'CONNECT' },
  '3744': { marca: 'PBC IVECO', modelo: 'EUROCARGO' },
  '3750': { marca: 'FIAT', modelo: 'DUCATO III' },
  '3764': { marca: 'FRC FORD', modelo: 'CARGO' },
  '3769': { marca: 'FORD', modelo: 'TRANSIT CUSTOM/LWB' },
  '3770': { marca: 'F', modelo: 'TRANSIT/TOURN CONNECT' },
  '3771': { marca: 'IVECO', modelo: 'DAILY' },
  '3772': { marca: 'FORD', modelo: 'TRANSIT 2/4P TECTO BXO/MED' },
  '3773': { marca: 'FORD', modelo: 'TRANSIT TETO ALTO 2/4P' },
  '3774': { marca: 'FORD', modelo: 'TRANSIT COURIER' },
  '3777': { marca: 'PBC IVECO', modelo: 'S-WAY/STRALIS AS' },
  '3779': { marca: 'PBC FORD', modelo: 'F-MAX' },
  '3785': { marca: 'FORD', modelo: 'TRANSIT CUSTOM' },
  '3940': { marca: 'HONDA', modelo: 'CIVIC 4P' },
  '3941': { marca: 'HONDA', modelo: 'CIVIC 3P' },
  '3952': { marca: 'HONDA', modelo: 'ACCORD 5P' },
  '3954': { marca: 'HONDA', modelo: 'CIVIC 5P' },
  '3956': { marca: 'HONDA CIVIC', modelo: '3P HK' },
  '3957': { marca: 'HONDA CIVIC', modelo: '4P' },
  '3967': { marca: 'HONDA', modelo: 'HRV 3/5P' },
  '3974': { marca: 'HONDA', modelo: 'CIVIC' },
  '3976': { marca: 'HONDA CIVIC', modelo: '3P' },
  '3978': { marca: 'HONDA', modelo: 'STREAM' },
  '3979': { marca: 'HONDA JAZZ', modelo: null },
  '3980': { marca: 'HONDA CIVIC', modelo: '4P' },
  '3986': { marca: 'HONDA ACCORD', modelo: 'SD/BK' },
  '3998': { marca: 'HONDA CIVIC', modelo: '5P' },
  '4000': { marca: 'HONDA', modelo: 'CRV 5P' },
  '4008': { marca: 'HONDA', modelo: 'CRZ' },
  '4011': { marca: 'HONDA', modelo: 'CRV 5P' },
  '4019': { marca: 'HONDA CIVIC', modelo: '5P HK' },
  '4025': { marca: 'HONDA', modelo: 'HR-V 5P' },
  '4115': { marca: 'HYUNDAI', modelo: 'ATOS' },
  '4116': { marca: 'HYUNDAI', modelo: 'H1/STAREX/H200' },
  '4118': { marca: 'HYUNDAI ACCENT', modelo: '/HYUNDAI ATOS PRIME' },
  '4127': { marca: 'HYUNDAI CPE', modelo: 'II' },
  '4133': { marca: 'FR HYUNDAI', modelo: 'SANTA FE S5' },
  '4135': { marca: 'HYUNDAI I', modelo: '30 5P' },
  '4139': { marca: 'HYUNDAI I', modelo: '20 3/5P' },
  '4146': { marca: 'HYUNDAI I', modelo: '40 5P' },
  '4157': { marca: 'HYUNDAI', modelo: null },
  '4159': { marca: 'HYUNDAI TUCSON', modelo: null },
  '4163': { marca: 'HYUNDAI', modelo: 'IONIQ 5P HK' },
  '4165': { marca: 'HYUNDAI', modelo: 'I30 5P HK/BK WAGON' },
  '4167': { marca: 'HYUDAI', modelo: 'KONA 5P' },
  '4178': { marca: 'HYUNDAI', modelo: 'I20 5P HK' },
  '4179': { marca: 'HYUNDAI TUCSON', modelo: '5P' },
  '4325': { marca: 'JAGUAR', modelo: 'XK8' },
  '4337': { marca: 'JAGUAR', modelo: 'F TYPE 2P' },
  '4338': { marca: 'JAGUAR', modelo: 'XE X760 4P' },
  '4340': { marca: 'JAGUAR', modelo: 'F-PACE 5P' },
  '4342': { marca: 'JAGUAR', modelo: 'I-PACE 5P' },
  '4408': { marca: 'KIA CARNIVAL', modelo: null },
  '4412': { marca: 'KIA', modelo: 'HERCULES/K2500/2700' },
  '4422': { marca: 'KIA', modelo: 'PICANTO 5P HK' },
  '4430': { marca: 'KIA', modelo: 'CARENS MV' },
  '4431': { marca: 'KIA', modelo: 'CEED 5P' },
  '4434': { marca: 'KIA', modelo: 'SOUL' },
  '4438': { marca: 'KIA', modelo: 'SPORTAGE 5P' },
  '4442': { marca: 'KIA', modelo: 'CEED 5P HK' },
  '4447': { marca: 'KIA', modelo: 'SPORTAGE 5P' },
  '4450': { marca: 'KIA', modelo: 'NIRO' },
  '4453': { marca: 'KIA RIO', modelo: 'YB 5P HK/STONIC 5P' },
  '4457': { marca: 'KIA CEED', modelo: '5P HK/BK' },
  '4465': { marca: 'KIA', modelo: 'EV6 5P CRSSVR' },
  '4466': { marca: 'KIA', modelo: 'NIRO 5P' },
  '4625': { marca: 'FRC DAF', modelo: '75/85' },
  '4633': { marca: 'PBC REN', modelo: 'MIDLUM-D NARROW/VOL FL/DAF LF45-55' },
  '4635': { marca: 'FRC DAF', modelo: 'XF 105' },
  '4637': { marca: 'MAXUS', modelo: 'EDELIVER9 3P' },
  '4638': { marca: 'PBC DAF', modelo: 'XF/XG' },
  '4725': { marca: 'LANCIA', modelo: 'Y10' },
  '4726': { marca: 'PB LANCIA', modelo: 'DELTA / PRISMA' },
  '4738': { marca: 'LANCIA', modelo: 'PHEDRA MV' },
  '4906': { marca: 'PBC MAN', modelo: 'H9 HAU' },
  '4907': { marca: 'PBC MAN', modelo: '19362 F90' },
  '4911': { marca: 'FRC MAN', modelo: 'TGA//TGL/TGM/TGS M/L/LX/CREW/C' },
  '4912': { marca: 'FRC MAN', modelo: 'TGA/TGL/TGM/TGS' },
  '4919': { marca: 'MAN', modelo: 'TGE/VW CRAFTER' },
  '5025': { marca: 'FRISO ESPUMA', modelo: null },
  '5058': { marca: 'FRISO UNIVERSAL', modelo: null },
  '5069': { marca: 'FRISO UNIVERSAL', modelo: null },
  '5113': { marca: 'BMW I', modelo: '3 I01 5P HK I01' },
  '5143': { marca: 'BMW I', modelo: '3 I01 5P HK I01' },
  '5144': { marca: 'BMW I', modelo: '3 I01 5P HK I01' },
  '5147': { marca: 'BMW I', modelo: '3 I01 5P HK I01' },
  '5155': { marca: 'MAZDA', modelo: '323 4P' },
  '5158': { marca: 'MAZDA B', modelo: '2500 2P PU' },
  '5159': { marca: 'MAZDA PREMACY', modelo: null },
  '5164': { marca: 'MAZDA', modelo: '6' },
  '5166': { marca: 'MAZDA', modelo: '3 5P' },
  '5172': { marca: 'VP MAZDA', modelo: 'BT50 PICK UP' },
  '5179': { marca: 'MAZDA CX', modelo: null },
  '5184': { marca: 'MAZDA', modelo: 'CX-3' },
  '5187': { marca: 'MAZDA', modelo: 'CX-5 5P' },
  '5191': { marca: 'VQL MAZDA', modelo: 'MX-30 5P' },
  '5213': { marca: 'MERCEDES CLAS', modelo: 'E W213 4P' },
  '5320': { marca: 'MERCEDES', modelo: '200/230 4P' },
  '5326': { marca: 'MERCEDES', modelo: '190 4P' },
  '5328': { marca: 'MERCEDES', modelo: 'W124' },
  '5329': { marca: 'MERCEDES', modelo: '190 4P' },
  '5333': { marca: 'MERCEDES', modelo: 'CLAS S 4P' },
  '5334': { marca: 'MERCEDES W', modelo: '202' },
  '5337': { marca: 'MERCEDES CLAS', modelo: 'E W210' },
  '5339': { marca: 'MERCEDES SLK', modelo: 'ROADSTERCB' },
  '5341': { marca: 'MERCEDES', modelo: 'CLK' },
  '5342': { marca: 'MERCEDES CLAS', modelo: 'A' },
  '5344': { marca: 'MERC', modelo: 'CLAS S W220 4P' },
  '5347': { marca: 'MERCEDES CLAS', modelo: 'E W211' },
  '5350': { marca: 'MERCEDES SMART', modelo: null },
  '5351': { marca: 'FR MERCEDES', modelo: 'W203' },
  '5352': { marca: 'MERCEDES W', modelo: '203' },
  '5353': { marca: 'MERCEDES', modelo: 'CLK 2P' },
  '5354': { marca: 'PB MERCEDES', modelo: 'CLASSE E 4P' },
  '5355': { marca: 'MERCEDES SMART', modelo: 'ROADSTER' },
  '5358': { marca: 'MERCEDES', modelo: 'CLAS B' },
  '5364': { marca: 'MERCEDES W', modelo: '204' },
  '5368': { marca: 'MERCEDES', modelo: 'SMART FOR TWO 3P' },
  '5370': { marca: 'MERC', modelo: 'CLAS E/C 2P' },
  '5371': { marca: 'MERCEDES W', modelo: '212' },
  '5372': { marca: 'OC MERCEDES', modelo: 'CLS SHOOTING BRAKE W218 5P' },
  '5374': { marca: 'MERC', modelo: 'CLAS E' },
  '5377': { marca: 'VQL MERCEDES', modelo: 'CLAS B W246 5P HK' },
  '5378': { marca: 'MERCEDES', modelo: 'CLAS M W166' },
  '5381': { marca: 'MERCEDES CLAS', modelo: 'A W176/C117' },
  '5382': { marca: 'MERC', modelo: 'VITO W447/W447 LWB/XLWB' },
  '5385': { marca: 'MERCEDES CLASS', modelo: 'C W205 5P' },
  '5388': { marca: 'TE SMART', modelo: 'FOR FOUR 5P HK' },
  '5391': { marca: 'MER', modelo: 'GLC X253 5P' },
  '5392': { marca: 'MERCEDES', modelo: 'CLAS E W213 5P' },
  '5397': { marca: 'MERC', modelo: 'GLC C253 4P' },
  '5398': { marca: 'MERCEDES', modelo: 'CLAS E' },
  '5399': { marca: 'M', modelo: 'W177 /CLA C118/X118' },
  '5416': { marca: 'FRC MERCEDES', modelo: '381/F LINE/P LINE/R LINE' },
  '5426': { marca: 'MERCEDES SPRINTER', modelo: 'CAB BAIXA' },
  '5427': { marca: 'MERCEDES SPRINTER', modelo: 'CAB ALTA' },
  '5428': { marca: 'MERCEDES VITO', modelo: null },
  '5429': { marca: 'FRC MERCEDES', modelo: 'ACTROS' },
  '5430': { marca: 'FRC MERCEDES', modelo: 'ATEGO' },
  '5438': { marca: 'MERCEDES VITO', modelo: null },
  '5439': { marca: 'MERCEDES SPRINTER', modelo: null },
  '5443': { marca: 'PBC MERC', modelo: null },
  '5444': { marca: 'PBC MERCEDES', modelo: 'ACTROS/AROCS' },
  '5447': { marca: 'MERCEDES', modelo: 'SPRINTER' },
  '5502': { marca: 'MERCEDES', modelo: 'CLAS B 5P MPV W247' },
  '5503': { marca: 'MER', modelo: 'GLE W167' },
  '5504': { marca: 'MERCEDES', modelo: 'EQC 5J' },
  '5505': { marca: 'MERCEDES GLB', modelo: '5P' },
  '5509': { marca: 'M CLAS', modelo: 'C W206 4P' },
  '5511': { marca: 'MERCEDES', modelo: 'EQE V295 4P' },
  '5512': { marca: 'MERC', modelo: 'GLC X254 5P' },
  '5517': { marca: 'MERC', modelo: 'GLC C254 5P' },
  '5518': { marca: 'MERC', modelo: 'CLASS E 4P' },
  '5521': { marca: 'MERCEDES', modelo: 'EQE 5P' },
  '5621': { marca: 'VQL MITSUB', modelo: 'PAJERO/SHOGUN 3/5P' },
  '5625': { marca: 'PBC MITSUBIS', modelo: 'CANT FE444/FH100/HYUNDAI H350' },
  '5628': { marca: 'MITSUBISHI', modelo: 'L200' },
  '5629': { marca: 'MITSUBISHI', modelo: 'L300' },
  '5637': { marca: 'MITSUBISHI PAJERO', modelo: null },
  '5642': { marca: 'MITSUBISHI', modelo: 'LANCER 4P' },
  '5646': { marca: 'MITSUBISHI', modelo: 'CARISMA' },
  '5650': { marca: 'MITSUBISHI', modelo: 'L200 STRADA' },
  '5652': { marca: 'VLC MITSUBISHI', modelo: 'CANTER FE 5/FE 6' },
  '5653': { marca: 'PBC MITSUBISHI', modelo: 'CANTER FE 6' },
  '5655': { marca: 'MITSUBISHI', modelo: 'SPACE STAR MPV' },
  '5660': { marca: 'MITSUBISHI', modelo: 'PAJERO 5P' },
  '5672': { marca: 'MITSUBISHI OUTLANDER', modelo: '5P' },
  '5677': { marca: 'MITSUBISHI', modelo: 'CANTER' },
  '5679': { marca: 'MITSUBISHI L', modelo: '200' },
  '5689': { marca: 'MITS ASX', modelo: '/PEUG 4008/CIT C4 AIRCROSS' },
  '5691': { marca: 'FRC MITSUBISHI', modelo: 'CANTER FE 100' },
  '5696': { marca: 'PBC MITSUBISHI', modelo: 'FUSO CANTER 7C15/7C18' },
  '5697': { marca: 'MITSUBISHI OUTLANDER', modelo: '5P' },
  '5701': { marca: 'M', modelo: 'L200' },
  '5702': { marca: 'MITSUBISHI', modelo: 'ECLIPSE CROSS 5P' },
  '5946': { marca: 'NISSAN', modelo: '720 2P PU' },
  '5952': { marca: 'NISSAN', modelo: 'SUNNY 4P' },
  '5957': { marca: 'NISSAN PATROL', modelo: null },
  '5966': { marca: 'NISSAN', modelo: 'TERRANO/D21 2/4P PU/WD21 3/5P' },
  '5977': { marca: 'NISSAN', modelo: '200 SX' },
  '5988': { marca: 'NISSAN MICRA', modelo: 'K11' },
  '5990': { marca: 'VQL NISSAN', modelo: 'TERRANO 5P' },
  '6000': { marca: 'NISSAN', modelo: null },
  '6001': { marca: 'NISSAN', modelo: 'ALMERA' },
  '6002': { marca: 'NISSAN PRIMERA', modelo: 'SAL/HK' },
  '6006': { marca: 'VP NISSAN', modelo: 'PATROL' },
  '6007': { marca: 'NISSAN ALMERA', modelo: '3/4/5P' },
  '6020': { marca: 'NISSAN PRIMERA', modelo: '4P' },
  '6037': { marca: 'NISSAN', modelo: 'NAVARA 4P PU D40' },
  '6044': { marca: 'NISSAN QASHQAI', modelo: '/GRD QASHQAI S/TECTO PAN' },
  '6045': { marca: 'NISSAN CABSTAR', modelo: 'PU' },
  '6069': { marca: 'FR NISSAN', modelo: 'JUKE 5P' },
  '6076': { marca: 'NISSAN', modelo: 'MICRA IV K13 5P HK' },
  '6077': { marca: 'NISSAN', modelo: 'LEAF 5P HK' },
  '6084': { marca: 'NISSAN QASHQAI', modelo: '5P' },
  '6089': { marca: 'NISSAN PULSAR', modelo: '5P HK' },
  '6094': { marca: 'NISSAN', modelo: 'NAVARA 4P PU' },
  '6097': { marca: 'NISSAN', modelo: 'MICRA B02E' },
  '6098': { marca: 'NISSAN', modelo: 'NV300' },
  '6102': { marca: 'NISSAN', modelo: 'JUKE 5P' },
  '6104': { marca: 'NISSAN QASHQAI', modelo: '5P' },
  '6108': { marca: 'NISSAN', modelo: 'X-TRAIL 5P' },
  '6247': { marca: 'OPEL', modelo: 'KADETT E' },
  '6253': { marca: 'OPEL', modelo: 'VECTRA' },
  '6257': { marca: 'OPEL ASTRA', modelo: 'BK' },
  '6259': { marca: 'OPEL CORSA', modelo: 'B' },
  '6275': { marca: 'OPEL', modelo: '/BEDFORD BRAVA/ISUZU AMIGO-RODEO-CAMPO' },
  '6277': { marca: 'OPEL VECTRA', modelo: '4S' },
  '6278': { marca: 'ISUZU', modelo: '/BEDFORD NKR/NHR 2P' },
  '6279': { marca: 'BEDFORD', modelo: 'NKR/NHR/NR93' },
  '6283': { marca: 'OPEL ZAFIRA', modelo: null },
  '6284': { marca: 'OPEL', modelo: '/VAUXHALL ASTRA' },
  '6287': { marca: 'OPEL FRONTERA', modelo: 'II' },
  '6290': { marca: 'OPEL CORSA', modelo: 'C 3/5P' },
  '6291': { marca: 'OPEL', modelo: null },
  '6292': { marca: 'OPEL COMBO', modelo: null },
  '6293': { marca: 'OPEL', modelo: 'INSIGNIA' },
  '6302': { marca: 'OC OPEL', modelo: 'ASTRA 5P' },
  '6303': { marca: 'OPEL TIGRA', modelo: 'TWIN TOP 2P' },
  '6304': { marca: 'ISUZU', modelo: 'RODEO / DMAX' },
  '6306': { marca: 'OPEL', modelo: 'ASTRA GTC' },
  '6311': { marca: 'ISUZU', modelo: 'NKR77' },
  '6312': { marca: 'OPEL', modelo: 'CORSA D' },
  '6320': { marca: 'ISUZU NLR', modelo: null },
  '6321': { marca: 'ISUZU NPR', modelo: '/NMR/NNR/NPS CB 2P' },
  '6324': { marca: 'OPEL', modelo: 'ASTRA 5P HK/BK' },
  '6336': { marca: 'OPEL', modelo: 'COMBO' },
  '6341': { marca: 'OPEL', modelo: 'CORSA E 3/5P HK' },
  '6342': { marca: 'OPEL', modelo: 'ASTRA 5P' },
  '6344': { marca: 'OPEL', modelo: 'INSIGNIA 5P HK' },
  '6345': { marca: 'O', modelo: 'CROSSLAND X/C C3 AIRCROSS 5P' },
  '6350': { marca: 'OPEL CORSA', modelo: '5P HK' },
  '6351': { marca: 'ISUZU', modelo: 'D-MAX 4D PU' },
  '6352': { marca: 'OPEL', modelo: 'MOKKA 5P' },
  '6355': { marca: 'OPEL', modelo: 'ASTRA 5P' },
  '6357': { marca: 'FRONTERA', modelo: 'CRSSOVR/C3 5P HK/AIRCRSS' },
  '6514': { marca: 'PEUGEOT', modelo: '205' },
  '6518': { marca: 'PEUGEOT', modelo: '405' },
  '6520': { marca: 'PEUGEOT', modelo: '106' },
  '6521': { marca: 'PEUGEOT', modelo: '306 3P' },
  '6522': { marca: 'PEUG', modelo: '806/EXP-CITR JUMPY/EVAS-FIAT ULYS/SCUD' },
  '6523': { marca: 'PEUGEOT', modelo: 'BOXER' },
  '6525': { marca: 'PEUGEOT', modelo: '406' },
  '6539': { marca: 'PEUGEOT', modelo: '206' },
  '6542': { marca: 'PEUGEOT', modelo: '307 3/5P' },
  '6544': { marca: 'PEUGEOT', modelo: '407' },
  '6547': { marca: 'PEUG', modelo: '1007 3P HK' },
  '6548': { marca: 'OC PEUGEOT', modelo: '207 5P BRK' },
  '6549': { marca: 'PEUGEOT', modelo: '107/C1 3P' },
  '6550': { marca: 'PEUGEOT', modelo: '407' },
  '6552': { marca: 'VP PEUGEOT', modelo: 'BOXER' },
  '6553': { marca: 'FIAT', modelo: 'SCUDO/806/EXPERT' },
  '6554': { marca: 'PEUGEOT', modelo: '308 3/5P HK' },
  '6559': { marca: 'PEUGEOT', modelo: '308 2P CC' },
  '6560': { marca: 'PEUGEOT', modelo: '3008/5008' },
  '6562': { marca: 'PEUGEOT', modelo: '508 4P' },
  '6564': { marca: 'PEUGEOT', modelo: '208 3/5P HK' },
  '6569': { marca: 'PEUGEOT', modelo: 'EXPERT/TRAVELLER' },
  '6570': { marca: 'PEUGEOT', modelo: '308 5P' },
  '6571': { marca: 'PEUGEOT', modelo: '3008/5008 5P' },
  '6572': { marca: 'PEUGEOT', modelo: '508 5P HK/BK' },
  '6573': { marca: 'P', modelo: 'PARTN/RIFT/C BERLG/O COMBO' },
  '6574': { marca: 'PEUGEOT', modelo: '208' },
  '6575': { marca: 'PEUGEOT', modelo: '2008 5P' },
  '6577': { marca: 'PEUGEOT', modelo: '308 5P HK/BK' },
  '6578': { marca: 'PEUGEOT', modelo: '3008/5008' },
  '6721': { marca: 'PORSCHE', modelo: '911' },
  '6728': { marca: 'PORSCHE', modelo: 'PANAMERA 5P HK' },
  '6729': { marca: 'PORSCHE', modelo: 'CAYENNE 5P' },
  '6736': { marca: 'PORSCHE', modelo: 'MACAN 5P' },
  '6747': { marca: 'PORSCHE', modelo: 'CAYMAN' },
  '6750': { marca: 'MASERATI GHIBLI', modelo: '( M157) 4P' },
  '7012': { marca: 'LANDROVER', modelo: 'DEFENDER 90/110 3/5P TT' },
  '7016': { marca: 'ROVER', modelo: '214/416' },
  '7017': { marca: 'LAND ROVER', modelo: 'DISCOVERY' },
  '7020': { marca: 'ROVER', modelo: '600' },
  '7022': { marca: 'LANDROVER DISCOVERY', modelo: null },
  '7023': { marca: 'LANDROVER', modelo: 'RANGE ROVER 5P TT' },
  '7024': { marca: 'LANDROVER', modelo: null },
  '7027': { marca: 'ROVER', modelo: '25/200/MG ZR 3/5P' },
  '7028': { marca: 'LANDROVER FREELANDER', modelo: null },
  '7029': { marca: 'LAND', modelo: 'ROVER DISCOVERY 5P TT' },
  '7033': { marca: 'RANGE', modelo: 'ROVER' },
  '7035': { marca: 'ROVER', modelo: '75 5P' },
  '7036': { marca: 'PB RANGE', modelo: 'ROVER SPORT' },
  '7042': { marca: 'RANGE', modelo: 'ROVER EVOQUE R3' },
  '7043': { marca: 'LANDR', modelo: 'EVOQUE 5P' },
  '7045': { marca: 'RANGE', modelo: 'ROVER SPORT 5P' },
  '7046': { marca: 'L', modelo: 'DISCOVERY SPORT L550' },
  '7047': { marca: 'VQL RRVR', modelo: 'VELAR 5P' },
  '7049': { marca: 'RANGE', modelo: 'ROVER EVOQUE 5P' },
  '7222': { marca: 'RENAULT', modelo: 'TRAFIC I' },
  '7227': { marca: 'RENAULT SUPER', modelo: '5/EXPRESS' },
  '7231': { marca: 'RENAULT', modelo: '19' },
  '7232': { marca: 'RENAULT CLIO', modelo: null },
  '7233': { marca: 'FRC RENAULT', modelo: 'AE380/500 MAGNUM' },
  '7236': { marca: 'RENAULT', modelo: 'TWINGO' },
  '7237': { marca: 'RENAULT', modelo: 'LAGUNA I 5P' },
  '7239': { marca: 'RENAULT MEGANE', modelo: null },
  '7242': { marca: 'FRC R', modelo: 'PREMIUM' },
  '7243': { marca: 'RENAULT', modelo: 'ESPACE/GRD ESPACE' },
  '7245': { marca: 'RENAULT MEGANE', modelo: 'SCENIC' },
  '7246': { marca: 'RENAULT KANGOO', modelo: '/NISSAN KUBISTAR' },
  '7247': { marca: 'REN MASTER', modelo: '-OP MOVANO-NIS INTERSTAR' },
  '7248': { marca: 'RENAULT CLIO', modelo: null },
  '7249': { marca: 'RENAULT LAGUNA', modelo: '5P HK/BK' },
  '7251': { marca: 'RENAULT', modelo: 'ESPACE' },
  '7252': { marca: 'REN TRAFIOPEL', modelo: 'VIVARO/ NIS PRIMASTAR' },
  '7253': { marca: 'PBC RENAULT', modelo: 'MIDLUM' },
  '7257': { marca: 'RENAULT MEGANE', modelo: 'SCENIC' },
  '7260': { marca: 'RENAULT MEGANE', modelo: 'II 3D/5D' },
  '7261': { marca: 'RENAULT', modelo: 'MEGANE' },
  '7262': { marca: 'RENAULT CLIO', modelo: 'III' },
  '7263': { marca: 'RENAULT', modelo: 'MODUS/GRD MODUS' },
  '7268': { marca: 'VQL RENAULT', modelo: 'TWINGO II 3P' },
  '7271': { marca: 'RENAULT', modelo: 'MASTER' },
  '7273': { marca: 'RENAULT', modelo: 'LAGUNA III 5P' },
  '7274': { marca: 'RENAULT', modelo: 'KANGOO' },
  '7275': { marca: 'RENAULT', modelo: 'MEGANE III 2P' },
  '7276': { marca: 'DACIA', modelo: 'SANDERO/DUSTER' },
  '7279': { marca: 'RENAULT MEGANE', modelo: 'III 5P' },
  '7280': { marca: 'REN', modelo: 'MEGANE GRD SCENIC/SCENIC' },
  '7281': { marca: 'REN MASTER', modelo: null },
  '7289': { marca: 'DACIA', modelo: 'LODGY 5P MPV 12/DOKKER 5P' },
  '7290': { marca: 'RENAULT', modelo: 'CLIO IV HK' },
  '7291': { marca: 'RENAULT', modelo: 'ZOE 5P HK' },
  '7292': { marca: 'DACIA', modelo: 'LOGAN 4P' },
  '7293': { marca: 'RENAULT CAPTUR', modelo: '5D' },
  '7294': { marca: 'FRC RENAULT', modelo: null },
  '7296': { marca: 'RENAULT', modelo: 'TRAFIC/NISSAN NV300' },
  '7299': { marca: 'RENAULT', modelo: 'ESPACE MVM' },
  '7302': { marca: 'RENAULT MEGANE', modelo: '5P' },
  '7303': { marca: 'RENAULT', modelo: 'MEGANE SCENIC MVM IV' },
  '7306': { marca: 'DACIA', modelo: 'DUSTER 5P CROSSOVER' },
  '7309': { marca: 'RENAULT', modelo: 'ARKANA 5P' },
  '7310': { marca: 'RENAULT CLIO', modelo: null },
  '7311': { marca: 'RENAULT CAPTUR', modelo: '5P' },
  '7312': { marca: 'RENAULT', modelo: 'KANGOO III' },
  '7313': { marca: 'DACIA', modelo: 'SANDERO 5P HK' },
  '7314': { marca: 'DACIA', modelo: 'SPRING 5P' },
  '7315': { marca: 'RENAULT', modelo: 'MEGANE E-TECH 5P HK' },
  '7316': { marca: 'R', modelo: 'AUSTRAL HHN 5P 22/ESPACE RHN 5P' },
  '7317': { marca: 'RENAULT', modelo: 'SCENIC E-TECH' },
  '7318': { marca: 'RENAULT', modelo: '5' },
  '7320': { marca: 'DACIA', modelo: 'DUSTER CROSSOVER' },
  '7408': { marca: 'SAAB', modelo: '900 3/5P' },
  '7506': { marca: 'FRC SCANIA', modelo: 'SERIE 4' },
  '7507': { marca: 'PBC SCANIA', modelo: 'SERIE 5' },
  '7508': { marca: 'PBC SCANIA', modelo: 'SERIE R/S/G/P/L' },
  '7550': { marca: 'VLE AUTOCARAVANA', modelo: null },
  '7603': { marca: 'SEAT', modelo: 'TOLEDO 91/IBIZA' },
  '7604': { marca: 'SEAT', modelo: 'IBIZA 3/5P' },
  '7606': { marca: 'SEAT', modelo: 'ALHAMBRA' },
  '7608': { marca: 'SEAT', modelo: 'TOLEDO' },
  '7609': { marca: 'SEAT', modelo: 'IBIZA 3/5P' },
  '7610': { marca: 'SEAT IBIZA', modelo: null },
  '7612': { marca: 'SEAT', modelo: 'ALTEA/TOLEDO' },
  '7613': { marca: 'SEAT', modelo: 'LEON' },
  '7614': { marca: 'SEAT', modelo: 'IBIZA ST 5P' },
  '7616': { marca: 'SEAT', modelo: 'ALHAMBRA/VW SHARAN MPV' },
  '7619': { marca: 'SEAT LEON', modelo: null },
  '7620': { marca: 'SEAT', modelo: 'ATECA 5P' },
  '7621': { marca: 'SEAT', modelo: 'IBIZA 5P HK' },
  '7622': { marca: 'SEAT', modelo: 'ARONA 5P' },
  '7624': { marca: 'SEAT LEON', modelo: '5P HK/BK' },
  '7625': { marca: 'FR CUPRA', modelo: 'FORMENTOR 5P' },
  '7627': { marca: 'CUPRA', modelo: 'TAVASCAN' },
  '7806': { marca: 'SKODA', modelo: 'FELICIA 5P/BK' },
  '7807': { marca: 'SKODA', modelo: 'OCTAVIA' },
  '7808': { marca: 'SKODA', modelo: 'FABIA 5P' },
  '7810': { marca: 'PB SKODA', modelo: 'OCTAVIA' },
  '7811': { marca: 'SKODA', modelo: 'FABIA' },
  '7816': { marca: 'SKODA', modelo: 'OCTAVIA 5P' },
  '7818': { marca: 'S', modelo: 'FABIA 5P' },
  '7819': { marca: 'SKODA', modelo: 'SUPERB 5P HK/BK' },
  '7821': { marca: 'SKODA', modelo: 'KAROQ 5P' },
  '7822': { marca: 'SKODA', modelo: 'SCALA 5P HK' },
  '7823': { marca: 'SKODA', modelo: 'KAMIQ 5P' },
  '7824': { marca: 'SKODA', modelo: 'OCTAVIA IV 5P HK/BK' },
  '7826': { marca: 'SKODA', modelo: 'FABIA IV 5P HK' },
  '7915': { marca: 'SUBARU', modelo: 'IMPREZA' },
  '7929': { marca: 'SUBARU', modelo: 'LEGACY 4P' },
  '8010': { marca: 'SUZUKI VITARA', modelo: null },
  '8020': { marca: 'SUZUKI', modelo: 'GRD VITARA' },
  '8037': { marca: 'SUZUKI', modelo: 'BKIFT 3/5P HK' },
  '8041': { marca: 'SUZUKI', modelo: 'VITARA 5P' },
  '8044': { marca: 'SUZUKI', modelo: 'SWIFT 5P HK' },
  '8103': { marca: 'TESLA', modelo: 'Y 5P' },
  '8104': { marca: 'TESLA', modelo: '3 4P' },
  '8162': { marca: 'PBC MAN', modelo: 'XL' },
  '8253': { marca: 'TOYOTA', modelo: 'CELICA AT 160' },
  '8255': { marca: 'PBC T', modelo: 'DYNA BU60-63/70/80-82' },
  '8259': { marca: 'TOYOTA COROLLA', modelo: 'EE90' },
  '8260': { marca: 'TOYOTA', modelo: 'COROLLA EE90 5P LFBK' },
  '8263': { marca: 'TOYOTA', modelo: 'LANDCRUISER BJ73/BF70' },
  '8266': { marca: 'TOYOTA', modelo: 'HILUX' },
  '8268': { marca: 'TOYOTA', modelo: 'HIACE' },
  '8280': { marca: 'TOY COROLLA', modelo: '3/5P HK/4P' },
  '8281': { marca: 'TOYOTA COROLLA', modelo: 'EE100 LB' },
  '8295': { marca: 'TOYOTA HIACE', modelo: 'LH102' },
  '8301': { marca: 'TOYOTA LANDCRUISER', modelo: 'J9 3/5P (PRADO)' },
  '8304': { marca: 'TOYOTA COROLLA', modelo: 'E11' },
  '8305': { marca: 'TOYOTA AVENSIS', modelo: null },
  '8308': { marca: 'TOYOTA', modelo: '4-RUNNER/HILUX 2/4P PU' },
  '8310': { marca: 'TOYOTA YARIS', modelo: null },
  '8317': { marca: 'TOYOTA', modelo: 'YARIS MV' },
  '8340': { marca: 'TOYOTA COROLLA', modelo: '3/4/5P' },
  '8341': { marca: 'TOYOTA LANDCRUISER', modelo: '3P (PRADO)' },
  '8343': { marca: 'PBC TOYOTA', modelo: 'DYNA 201W' },
  '8345': { marca: 'PBC TOYOTA', modelo: 'DYNA 211W' },
  '8346': { marca: 'TOYOTA', modelo: 'AVENSIS' },
  '8355': { marca: 'TOYOTA', modelo: 'PRIUS' },
  '8356': { marca: 'TOYOTA', modelo: 'COROLLA MV' },
  '8367': { marca: 'TOYOTA HILUX', modelo: null },
  '8370': { marca: 'TO', modelo: 'YARIS HK' },
  '8371': { marca: 'TOYOTA', modelo: 'LANDCRUISER' },
  '8374': { marca: 'TOYOTA', modelo: 'AURIS 3/5P HK' },
  '8379': { marca: 'VQL TOYOTA', modelo: 'AVENSIS' },
  '8381': { marca: 'TOYOTA', modelo: 'URBAN CRUISER 5P HK' },
  '8382': { marca: 'TOYOTA', modelo: 'VERSO MV' },
  '8385': { marca: 'TOYOTA PRIUS', modelo: null },
  '8400': { marca: 'TOYOTA YARIS', modelo: '3/5P' },
  '8409': { marca: 'TOYOTA', modelo: 'AURIS 5P' },
  '8421': { marca: 'TOYOTA', modelo: 'C-HR 5P CROSSOVER' },
  '8423': { marca: 'PROAC', modelo: '/VERSO/TRVLLER/EXPRT/JMPY/SPCTOURR' },
  '8424': { marca: 'TOYOTA', modelo: 'HILUX 2/4P PU' },
  '8430': { marca: 'TOYOTA', modelo: 'COROLLA E210 5P HK/BK/4P' },
  '8432': { marca: 'TOYOTA RAV', modelo: '4 5P' },
  '8438': { marca: 'TOYOTA', modelo: 'YARIS 5P HK' },
  '8440': { marca: 'TOYOTA', modelo: 'YARIS CROSS 5P' },
  '8441': { marca: 'TOYOTA', modelo: 'YARIS 3P HK' },
  '8443': { marca: 'TOYOTA', modelo: 'AYGO X 730B 5P CROSSOVER' },
  '8453': { marca: 'TOY', modelo: 'CHR 130D 5P CROSSOVER' },
  '8533': { marca: 'VW', modelo: 'GOLF II' },
  '8534': { marca: 'AUDI', modelo: '80' },
  '8535': { marca: 'VW', modelo: 'PASSAT' },
  '8537': { marca: 'VW TRANSPORTER', modelo: null },
  '8541': { marca: 'VW', modelo: 'GOLF III' },
  '8545': { marca: 'VW', modelo: 'POLO III 3/5 P HK' },
  '8547': { marca: 'AUDI A', modelo: '4' },
  '8552': { marca: 'VW', modelo: 'LT' },
  '8554': { marca: 'AUDI A', modelo: '3' },
  '8556': { marca: 'VW PASSAT', modelo: 'B5' },
  '8558': { marca: 'VW', modelo: 'GOLF IV' },
  '8559': { marca: 'VW', modelo: 'BEETLE' },
  '8565': { marca: 'AUDI', modelo: 'A6' },
  '8568': { marca: 'VW', modelo: 'GOLF V' },
  '8570': { marca: 'VW', modelo: 'POLO' },
  '8572': { marca: 'AUDI', modelo: 'A4' },
  '8573': { marca: 'VW', modelo: 'POLO 3/5P' },
  '8577': { marca: 'VW', modelo: 'TOURAN' },
  '8579': { marca: 'VW', modelo: 'TRANSPORTER/MULTIVAN T5' },
  '8580': { marca: 'ESP AUDI', modelo: 'A3' },
  '8581': { marca: 'VW CADDY', modelo: null },
  '8582': { marca: 'AUDI', modelo: 'A6' },
  '8584': { marca: 'VW', modelo: 'PASSAT B7 4P' },
  '8586': { marca: 'VW', modelo: 'GOLF V 5P' },
  '8588': { marca: 'AUDI', modelo: 'Q7 5P' },
  '8589': { marca: 'AUDI', modelo: 'A4' },
  '8590': { marca: 'VQL VW', modelo: 'CRAFTER' },
  '8591': { marca: 'AUDI', modelo: 'TT' },
  '8594': { marca: 'AUDI', modelo: 'TT/TTS' },
  '8596': { marca: 'PB AUDI', modelo: 'Q5 5P' },
  '8598': { marca: 'VW PASSAT', modelo: '4P' },
  '8599': { marca: 'AUDI', modelo: 'A3' },
  '8600': { marca: 'VW', modelo: 'GOLF VI 3/5P HK' },
  '8603': { marca: 'VW', modelo: 'POLO V 3/5P HK' },
  '8604': { marca: 'AUDI', modelo: 'A1 3P HK' },
  '8611': { marca: 'AUDI', modelo: 'A6 4P' },
  '8612': { marca: 'VW', modelo: 'JETTA 4P' },
  '8616': { marca: 'AUDI', modelo: 'A3 3P' },
  '8618': { marca: 'VW', modelo: 'GOLF VARIANT VII 5P' },
  '8620': { marca: 'AUDI', modelo: 'A3 4P' },
  '8623': { marca: 'AUDI', modelo: 'Q7 5P' },
  '8624': { marca: 'AUDI', modelo: 'TT 2P' },
  '8626': { marca: 'VW', modelo: 'PASSAT B8 4P' },
  '8627': { marca: 'VW', modelo: 'TIGUAN 5P' },
  '8631': { marca: 'AUDI A', modelo: '4 5P' },
  '8632': { marca: 'AUDI', modelo: 'Q2 5P' },
  '8633': { marca: 'AUDI', modelo: 'A5 5P HK SPORTBACK/2P' },
  '8635': { marca: 'VW', modelo: 'CRAFTER' },
  '8637': { marca: 'VW', modelo: 'ARTEON 4P' },
  '8640': { marca: 'V', modelo: 'POLO 5P HK' },
  '8641': { marca: 'VW', modelo: 'T-ROC 5P' },
  '8644': { marca: 'AUDI', modelo: 'A6 4P' },
  '8645': { marca: 'VQL AUDI', modelo: 'Q8 5P' },
  '8646': { marca: 'AUDI', modelo: 'E-TRON 5P' },
  '8647': { marca: 'AUDI', modelo: 'A1 5P HK' },
  '8648': { marca: 'AUDI', modelo: 'Q3 5P' },
  '8649': { marca: 'VW', modelo: 'T-CROSS 5P' },
  '8650': { marca: 'VW', modelo: 'GOLF VIII 5P HK/VARIANT 5P' },
  '8654': { marca: 'AUDI', modelo: 'A3 SPORTBACK 5P HK/4P' },
  '8659': { marca: 'VW', modelo: 'CADDY' },
  '8664': { marca: 'VW', modelo: 'TRANSPORTER/MULTIVAN T7' },
  '8669': { marca: 'VW', modelo: 'TIGUAN 5P' },
  '8670': { marca: 'VW', modelo: 'PASSAT 5P' },
  '8814': { marca: 'PBC VOLVO', modelo: 'FL7/FL10' },
  '8823': { marca: 'FRC VOLVO', modelo: 'FH12/FH16' },
  '8824': { marca: 'VOLVO', modelo: 'S40/V40' },
  '8829': { marca: 'VOLVO', modelo: 'S60/V70/XC70' },
  '8831': { marca: 'VOLVO', modelo: 'XC90 5P' },
  '8832': { marca: 'VOLVO', modelo: 'S40' },
  '8836': { marca: 'VOLVO', modelo: 'S80/V70/XC70' },
  '8839': { marca: 'PB VOLVO', modelo: 'XC90' },
  '8840': { marca: 'VOLVO', modelo: 'XC60 5P' },
  '8841': { marca: 'V', modelo: 'S60/V60' },
  '8842': { marca: 'VOLVO V', modelo: '40/V40 CROSS COUNTRY' },
  '8844': { marca: 'PBC VOLVO', modelo: 'FH' },
  '8845': { marca: 'VOLVO', modelo: 'V90 5P' },
  '8846': { marca: 'VOLVO', modelo: 'XC60 5P' },
  '8847': { marca: 'VOLVO', modelo: 'XC40 5P' },
  '8848': { marca: 'VOLVO', modelo: 'V60 5P' },
  '8851': { marca: 'VOLVO', modelo: 'EX30 5P' },
  '9000': { marca: 'PBE AUTOCARAVANA', modelo: null },
  '9090': { marca: 'FRE AUTOCARAVANA', modelo: null },
  '9288': { marca: 'JEEP', modelo: 'GRD CHEROKEE' },
  '9550': { marca: 'AIXAM', modelo: null },
  '9601': { marca: 'HYUNDAI', modelo: 'TUCSON' },
  '9608': { marca: 'FRC MERCEDES', modelo: null },
  '9676': { marca: 'PBC TOYOTA', modelo: null },
  '9684': { marca: 'TESLA', modelo: 'S 5P HK' },
  '9825': { marca: 'PEUGEOT', modelo: '2008 5P' },
  '9909': { marca: 'MERCEDES', modelo: null }
};

function getVehicleFromEurocode(eurocode) {
  if (!eurocode || eurocode.length < 4) return null;
  const prefix = eurocode.substring(0, 4);
  const info = EUROCODE_PREFIX_MAP[prefix];
  if (!info) return null;
  return {
    marca: info.marca,
    modelo: info.modelo,
    confianca: 'alta',
    fonte: 'eurocode_prefix'
  };
}
// ===== FIM DO MAPEAMENTO =====



const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

const ok = (data) => ({
  statusCode: 200,
  headers: jsonHeaders,
  body: JSON.stringify(data)
});

const err = (status, message, details = null) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify({ 
    ok: false, 
    error: message,
    details: details 
  })
});

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return ok({ ok: true });
    }

    if (event.httpMethod !== 'POST') {
      return err(405, 'Método não permitido');
    }

    // Parse do body
    const { imageBase64 } = JSON.parse(event.body || '{}');
    
    if (!imageBase64) {
      return err(400, 'Nenhuma imagem enviada');
    }

    // Validar tamanho da imagem (máx 5MB em base64)
    if (imageBase64.length > 7000000) {
      return err(400, 'Imagem demasiado grande (máx 5MB)');
    }

    console.log('🔍 Processando imagem com Claude 3.5 Haiku...');
    const startTime = Date.now();

    // Chamar Claude API
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64
              }
            },
            {
              type: "text",
              text: `Analisa esta etiqueta de vidro automotivo da ExpressGlass.

INSTRUÇÕES:
1. Extrai TODAS as informações visíveis na etiqueta
2. Identifica o Eurocode principal (formato típico: 4 dígitos + 2 letras + alfanumérico)
   Exemplos: 1234AB567890, 8765CD123456, 4321EF789012
3. Se houver múltiplos Eurocodes visíveis, lista todos
4. Identifica a marca do fabricante do vidro
   Marcas comuns: PILKINGTON, SAINT-GOBAIN SEKURIT, AGC, SEKURIT, GUARDIAN, VITRO, FUYAO, SHATTERPRUFE
5. Identifica o veículo compatível (marca e modelo)
   IMPORTANTE: Procura por texto como "NISSAN ALMERA", "BMW SERIE 3", "VW GOLF", etc.
   A marca do veículo geralmente aparece ANTES do modelo na mesma linha
   Exemplos: "NISSAN ALMERA" → marca=Nissan, modelo=Almera
            "BMW SERIE 3" → marca=BMW, modelo=Serie 3
            "VW GOLF" → marca=VW, modelo=Golf
6. Identifica o tipo de vidro (parabrisas, lateral, traseiro, etc.)
7. Identifica características especiais visíveis:
   - Sensor de chuva
   - Aquecimento (heated)
   - Acústico (acoustic)
   - ADAS (câmara, sensores)
   - Tonalidade (verde, cinza, azul)
   - Antena integrada
   - Qualquer outra característica técnica

FORMATO DE RESPOSTA:
Responde APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json), sem explicações, sem texto adicional.

{
  "eurocode": "código principal identificado ou null",
  "eurocodes_alternativos": ["outros códigos encontrados"],
  "marca_fabricante": "marca do vidro em MAIÚSCULAS ou null",
  "veiculo_marca": "marca do veículo (ex: Nissan, BMW, VW) ou null",
  "veiculo_modelo": "modelo do veículo (ex: Almera, Serie 3, Golf) ou null",
  "veiculo_anos": "anos compatíveis (ex: 2015-2020) ou null",
  "tipo_vidro": "tipo (ex: Parabrisas, Vidro lateral direito, Vidro traseiro) ou null",
  "caracteristicas": ["lista de características especiais"],
  "observacoes": "qualquer informação adicional relevante ou null",
  "confianca": "alta/média/baixa",
  "texto_completo": "todo o texto visível na imagem"
}

REGRAS IMPORTANTES:
- Se não conseguires identificar algum campo com certeza, usa null
- Para confiança: 
  * "alta" = todos os campos principais estão claros e legíveis
  * "média" = alguns campos têm dúvidas ou imagem parcialmente legível
  * "baixa" = imagem muito pouco legível ou informação muito incerta
- No texto_completo, inclui TODO o texto que consegues ler, linha por linha
- Se vires códigos que parecem Eurocodes mas não tens certeza, inclui em eurocodes_alternativos
- Mantém os nomes das marcas FABRICANTES em MAIÚSCULAS (ex: PILKINGTON, não Pilkington)
- Para marca e modelo do VEÍCULO, usa capitalização normal (ex: Nissan Almera, não NISSAN ALMERA)
- SEMPRE tenta extrair o modelo do veículo se a marca estiver presente na mesma linha

RESPONDE APENAS COM O JSON, SEM MAIS NADA.`
            }
          ]
        }
      ]
    });

    const duration = Date.now() - startTime;

    // Extrair resposta
    const responseText = message.content[0].text;
    console.log('📄 Resposta do Claude (primeiros 200 chars):', responseText.substring(0, 200) + '...');

    // Parse JSON
    let jsonResponse;
    try {
      // Limpar possível markdown ou texto extra
      const cleanText = responseText
        .replace(/```json\n?/g, '')
        .replace(/\n?```/g, '')
        .trim();
      
      jsonResponse = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      console.error('Resposta recebida:', responseText);
      
      // Fallback: retornar texto bruto
      return ok({
        ok: true,
        text: responseText,
        data: null,
        error: 'Resposta não está em formato JSON válido',
        raw: responseText,
        performance: {
          duration_ms: duration,
          model: 'claude-3-5-haiku-20241022'
        }
      });
    }

    // Validar campos obrigatórios
    if (!jsonResponse.eurocode && !jsonResponse.texto_completo) {
      console.warn('⚠️ Nenhum Eurocode ou texto encontrado');
    }

    // Enriquecer com mapeamento de Eurocode (se disponível)
    if (jsonResponse.eurocode) {
      const vehicleFromEurocode = getVehicleFromEurocode(jsonResponse.eurocode);
      
      if (vehicleFromEurocode) {
        console.log('📍 Mapeamento Eurocode encontrado:', vehicleFromEurocode);
        
        // SEMPRE usar mapeamento se disponível (mais confiável que OCR)
        if (vehicleFromEurocode.marca) {
          jsonResponse.veiculo_marca = vehicleFromEurocode.marca;
          console.log('✅ Marca definida via Eurocode:', vehicleFromEurocode.marca);
        }
        
        if (vehicleFromEurocode.modelo) {
          jsonResponse.veiculo_modelo = vehicleFromEurocode.modelo;
          console.log('✅ Modelo definido via Eurocode:', vehicleFromEurocode.modelo);
        }
        
        // Adicionar fonte da informação
        jsonResponse.fonte_veiculo = vehicleFromEurocode.fonte;
      } else {
        console.log('⚠️ Eurocode não encontrado no mapeamento:', jsonResponse.eurocode);
      }
    }

    // Log de sucesso
    console.log('✅ OCR processado com sucesso');
    console.log(`⏱️ Duração: ${duration}ms`);
    console.log(`📊 Tokens: input=${message.usage.input_tokens}, output=${message.usage.output_tokens}`);
    console.log(`🎯 Confiança: ${jsonResponse.confianca}`);
    console.log(`🔢 Eurocode: ${jsonResponse.eurocode || 'não encontrado'}`);

    // Retornar sucesso
    return ok({
      ok: true,
      data: jsonResponse,
      text: jsonResponse.texto_completo || jsonResponse.eurocode || '',
      model: 'claude-3-5-haiku-20241022',
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      },
      performance: {
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('❌ Erro no OCR Claude:', error);
    
    // Erros específicos da API Anthropic
    if (error.status === 401) {
      return err(401, 'API Key inválida ou expirada', 'Verifica a variável ANTHROPIC_API_KEY no Netlify');
    }
    
    if (error.status === 429) {
      return err(429, 'Limite de requisições excedido', 'Aguarda alguns segundos e tenta novamente');
    }
    
    if (error.status === 529) {
      return err(529, 'API temporariamente indisponível', 'Serviço da Anthropic está sobrecarregado, tenta novamente em alguns minutos');
    }

    if (error.status === 400) {
      return err(400, 'Requisição inválida', error.message);
    }

    // Erro genérico
    return err(500, 'Erro ao processar OCR com Claude', error.message);
  }
};

