# Asset provenance ledger

Every generated asset in this build, with the model endpoint and the prompt or source that produced it (GDD 19.2).
All generation ran through fal.ai. Runtime files are processed copies (resized/compressed WebP textures, meshopt GLB, normalised MP3).

**Rights note.** The 2009 Madness concept sketch from *Destiny Gate: Concept Overview and Artwork* (© 2009 Paul Limon / Nick Creature) was used as the visual reference for the Madness character. Rights to the title, branding and that artwork must be confirmed before any public distribution (GDD B.2).

Total generated items: **168**

## Character concept (2)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `c_madness_front` | `fal-ai/nano-banana-pro/edit` | 2026-11-12 | Redesign this 2009 concept sketch of the creature 'Madness' as a photorealistic AAA horror game character reference, keeping its identity: a padded asylum cell turned inside-out and bound in a straitjacket. Single figure, strict front view, full body, standing (reference: 2009 Madness concept sketch) |
| `c_mitchell_front` | `fal-ai/nano-banana-pro` | 2026-11-12 | Full-body character reference sheet image for a AAA video game, single figure, strict front view, standing in a relaxed A-pose with arms held straight and away from the body at 40 degrees, legs slightly apart, palms facing thighs. The character: Mitchell Slate |

## Character mesh (2)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `m_madness` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `c_madness_front` |
| `m_mitchell` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `c_mitchell_front` |

## Rig + animation (4)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `r_madness_a` | `meshy/rigging/multi-animation` | 2026-11-12 | derived from `m_madness` (Meshy animation presets [12, 112, 119, 113, 509, 4, 242, 386, 178, 366]) |
| `r_madness_b` | `meshy/rigging/multi-animation` | 2026-11-12 | derived from `m_madness` (Meshy animation presets [336, 16, 8, 339]) |
| `r_mitchell_a` | `meshy/rigging/multi-animation` | 2026-11-12 | derived from `m_mitchell` (Meshy animation presets [0, 30, 14, 33, 53, 219, 283, 178, 187, 344]) |
| `r_mitchell_b` | `meshy/rigging/multi-animation` | 2026-11-12 | derived from `m_mitchell` (Meshy animation presets [2, 285, 8, 366, 559, 337, 341]) |

## Tiling PBR material (13)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `t_brass` | `fal-ai/patina/material` | 2026-11-12 | old tarnished brushed brass sheet metal, fine directional brushing, fingerprints, localized dark tarnish and verdigris specks, flat lit, seamless texture |
| `t_canvas` | `fal-ai/patina/material` | 2026-11-12 | dirty quilted padded cell wall canvas, thick off-white bone coloured cotton duck fabric with diamond tufting, stains, grime, stitched seams, heavy fabric weave, flat lit, seamless texture |
| `t_ceiling` | `fal-ai/patina/material` | 2026-11-12 | aged cream painted tongue-and-groove wooden ceiling boards of a 1930s train carriage, nicotine yellowing, hairline paint cracks, soot staining, satin, flat lit, seamless texture |
| `t_floor` | `fal-ai/patina/material` | 2026-11-12 | 1930s railway carriage floor, worn dark stained pine floorboards running lengthwise, scuffed, ingrained soot and grime in the gaps, matte, flat lit, seamless texture |
| `t_grate` | `fal-ai/patina/material` | 2026-11-12 | industrial cast iron floor grating with tight rectangular bar pattern seen from directly above, dark worn metal, grease, flat lit, seamless texture |
| `t_gravel` | `fal-ai/patina/material` | 2026-11-12 | railway track ballast, dark grey crushed stone gravel dusted with snow and soot, top view, flat lit, seamless texture |
| `t_iron` | `fal-ai/patina/material` | 2026-11-12 | dark locomotive boiler plate steel with rows of dome rivets, chipped black enamel paint, oil stains, machining marks, flat lit, seamless texture |
| `t_leather` | `fal-ai/patina/material` | 2026-11-12 | old dark oxblood brown leather, creased, cracked finish, worn edges, flat lit, seamless texture |
| `t_rust` | `fal-ai/patina/material` | 2026-11-12 | heavily oxidized rusted iron plate, flaking orange-brown rust over dark steel, pitting, flat lit, seamless texture |
| `t_steel` | `fal-ai/patina/material` | 2026-11-12 | blued gunmetal steel, dark blue-black satin machined metal with fine scratches and oil sheen, flat lit, seamless texture |
| `t_stone` | `fal-ai/patina/material` | 2026-11-12 | massive soot-blackened granite masonry blocks of a Victorian railway station wall, damp streaks, fine mortar joints, flat lit, seamless texture |
| `t_walnut` | `fal-ai/patina/material` | 2026-11-12 | 1930s railway carriage wall panelling, deep walnut wood veneer, vertical boards with fine straight grain, aged varnish with subtle wear and soft sheen, dark brown, flat lit, seamless texture |
| `t_wool` | `fal-ai/patina/material` | 2026-11-12 | worn tobacco brown wool moquette upholstery fabric of a 1930s train seat, tight woven pile, subtle wear and pilling, flat lit, seamless texture |

## Prop concept image (27)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `p_bench_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | Product photograph of a single 1930s American third-class railway carriage bench seat for two passengers, three-quarter front view from slightly above. Dark varnished walnut wood frame with turned end panel, high straight backrest and seat cushion upholstered  |
| `p_cabinet_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A small 1930s wall-mounted conductor's cabinet from a train: dark walnut box with a glass-paned door, brass hinges and keyhole, a brass hook inside, front view slightly angled. Authentic aged 1930s period object, photorealistic, physically based materials. Iso |
| `p_cable_handle_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A wall-mounted emergency pull handle on a steel cable: a brass T-shaped handle with red painted grip hanging from a tensioned steel cable that runs through a small iron pulley bracket. Authentic aged 1930s period object, photorealistic, physically based materi |
| `p_ceiling_lamp_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s railway carriage ceiling lamp: a round tarnished brass ceiling mount with a hanging frosted opal glass bowl shade held by three brass arms. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamle |
| `p_coach_ext_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1920s American heavyweight passenger railway coach exterior, dark olive green riveted steel body with a row of rectangular windows, clerestory roof, steps at each end, side three-quarter view, full length in frame. Authentic aged 1930s period object, photore |
| `p_counterweight_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A massive cast iron counterweight block from railway machinery, rectangular with chamfered corners and raised foundry lettering worn away, hanging from a thick iron chain and shackle, rust and grease. Authentic aged 1930s period object, photorealistic, physica |
| `p_crate_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s wooden shipping crate with rope handles, stencilled markings worn off, iron corner brackets. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamless background, soft even studio lighting, no ha |
| `p_door_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s railway carriage interior end door: dark varnished walnut door with a tall frosted glass window pane in the upper half, brass lever handle and brass kick plate, in its simple wooden frame, straight front view. Authentic aged 1930s period object, photor |
| `p_heater_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s railway carriage steam heater radiator: low long cast iron finned pipe radiator with brass valve wheel, chipped dark paint. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamless background, s |
| `p_lantern_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | An antique brass railroad conductor's hand lantern with a wire guard cage, a clear glass globe filled with softly glowing warm golden liquid light, a looped carrying handle on top, droplets of glowing liquid at the base. Authentic aged 1930s period object, pho |
| `p_latch_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A heavy industrial door latch mechanism from a 1930s train service door: a worn brass housing plate with a blue-steel lever bolt and a square nut, mounted on a small piece of dark iron plate. Authentic aged 1930s period object, photorealistic, physically based |
| `p_locomotive_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A black 1920s American steam locomotive with tender, side three-quarter view, soot-covered boiler, large driving wheels with connecting rods, brass bell, single round headlamp. Authentic aged 1930s period object, photorealistic, physically based materials. Iso |
| `p_passenger_a_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A seated 1930s male train passenger, full body, sitting upright on a simple wooden bench with hands on his knees, wearing a dark heavy wool overcoat and a flat cap pulled low, face in shadow under the cap brim, sombre. Authentic aged 1930s period object, photo |
| `p_passenger_b_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A seated 1930s woman train passenger, full body, sitting on a simple wooden bench with a handbag on her lap, wearing a dark wool coat with fur collar and a cloche hat, head bowed so the face is hidden. Authentic aged 1930s period object, photorealistic, physic |
| `p_passenger_c_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s male train passenger in a seated pose as if sitting on an invisible seat, thighs horizontal, hands resting on his knees, wearing a dark heavy wool overcoat and a flat cap pulled low, face in shadow under the cap brim, sombre. Photorealistic, physically |
| `p_passenger_d_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s woman train passenger in a seated pose as if sitting on an invisible seat, thighs horizontal, a handbag held on her lap, wearing a dark wool coat with fur collar and a cloche hat, head bowed so the face is hidden. Photorealistic, physically based mater |
| `p_passenger_e_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s elderly male train passenger in a seated pose as if sitting on an invisible seat, thighs horizontal, slumped asleep with arms folded, wearing a worn grey tweed overcoat, scarf and a homburg hat tipped over his eyes. Photorealistic, physically based mat |
| `p_rack_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A section of a 1930s railway carriage overhead luggage rack: ornate cast brass wall brackets holding a shelf of parallel brass tubes and string netting, 1.5 metres long, viewed from below-front. Authentic aged 1930s period object, photorealistic, physically ba |
| `p_release_pin_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A heavy railway coupling release mechanism: a thick blue-steel pin with a ring handle seated in a tarnished brass housing bolted on a riveted iron base, with a red painted tension mark. Authentic aged 1930s period object, photorealistic, physically based mater |
| `p_sample_case_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s travelling salesman's sample case: tall rectangular black leatherette case with nickel latches and a worn leather handle, standing upright. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamle |
| `p_sconce_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A 1930s railway carriage wall lamp: small tarnished brass wall bracket with a tulip-shaped frosted ribbed glass shade pointing up. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamless background, so |
| `p_station_lantern_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A monumental surreal station lamp: a huge barrel-shaped lantern with glowing white segmented glass panels held in an organic art-nouveau cast iron cage, standing on a swollen sculpted stone pedestal, like a nightmare railway station fixture. Authentic aged 193 |
| `p_suitcase_a_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A battered 1930s brown leather suitcase with brass corner caps, two straps with buckles and travel wear. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamless background, soft even studio lighting, n |
| `p_suitcase_b_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A stack of three mismatched 1930s travel cases: a large dark green steamer trunk with wooden slats at the bottom, a tan leather suitcase, and a small cardboard case tied with string on top. Authentic aged 1930s period object, photorealistic, physically based m |
| `p_valves_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A cluster of old brass steam pipes with two red valve wheels and a pressure gauge with a cracked glass face, mounted on a dark iron bracket. Authentic aged 1930s period object, photorealistic, physically based materials. Isolated on a plain white seamless back |
| `p_watch_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A large antique brass conductor's pocket watch with open face, engraved case with a locomotive motif, ivory dial with black roman numerals, blued steel hands, a short chain, slightly tarnished. Authentic aged 1930s period object, photorealistic, physically bas |
| `p_wrench_img` | `fal-ai/nano-banana-pro` | 2026-11-12 | A massive antique railroad track wrench, 80 cm long, single open jaw, forged blue-black steel shaft with hammered texture, a brass collar ring and worn leather-wrapped grip, heavy and slightly sinister, lying diagonally. Authentic aged 1930s period object, pho |

## Prop mesh (28)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `g_bench` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_bench_img` |
| `g_bench_lo` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_bench_img` |
| `g_cabinet` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_cabinet_img` |
| `g_cable_handle` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_cable_handle_img` |
| `g_ceiling_lamp` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_ceiling_lamp_img` |
| `g_coach_ext` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_coach_ext_img` |
| `g_counterweight` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_counterweight_img` |
| `g_crate` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_crate_img` |
| `g_door` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_door_img` |
| `g_heater` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_heater_img` |
| `g_lantern` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_lantern_img` |
| `g_latch` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_latch_img` |
| `g_locomotive` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_locomotive_img` |
| `g_passenger_a` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_passenger_a_img` |
| `g_passenger_b` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_passenger_b_img` |
| `g_passenger_c` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_passenger_c_img` |
| `g_passenger_d` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_passenger_d_img` |
| `g_passenger_e` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_passenger_e_img` |
| `g_rack` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_rack_img` |
| `g_release_pin` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_release_pin_img` |
| `g_sample_case` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_sample_case_img` |
| `g_sconce` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_sconce_img` |
| `g_station_lantern` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_station_lantern_img` |
| `g_suitcase_a` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_suitcase_a_img` |
| `g_suitcase_b` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_suitcase_b_img` |
| `g_valves` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_valves_img` |
| `g_watch` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_watch_img` |
| `g_wrench` | `meshy/v7.1/image-to-3d` | 2026-11-12 | derived from `p_wrench_img` |

## Flat art (6)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `f_exterior` | `fal-ai/nano-banana-pro` | 2026-11-12 | Seamless horizontally tiling panorama of a flat snow-covered midwestern farmland at blue hour seen from a moving train in December 1932: distant bare tree lines, a few telegraph poles, one far farmhouse with a single lit window, low mist, heavy overcast sky, d |
| `f_grime` | `fal-ai/nano-banana-pro` | 2026-11-12 | Dirty train window glass texture: soot streaks, condensation droplets and frost creeping in from the edges, fingerprints, on pure black background, white marks only, high contrast, flat. |
| `f_order` | `fal-ai/nano-banana-pro` | 2026-11-12 | A scanned 1932 carbon-copy sales order form from 'STANDARD STEEL CO.', typed columns of quantities and prices that are struck through and overtyped again and again, a red stamp reading 'DECLINED', coffee ring, folded creases, flat scan on black. |
| `f_photo` | `fal-ai/nano-banana-pro` | 2026-11-12 | A worn 1929 sepia studio portrait photograph of a young mother seated with a toddler boy on her lap and a little girl of about five standing beside her, formal clothes of the period, gentle smiles, soft vignette, creased and thumb-worn print with a white deckl |
| `f_station_matte` | `fal-ai/nano-banana-pro` | 2026-11-12 | Cinematic matte painting of an impossibly vast subterranean railway station cavern: dozens of elevated iron viaducts and railway tracks crossing in impossible Escher-like directions at different angles and heights, some upside down, colossal art-nouveau stone  |
| `f_ticket` | `fal-ai/nano-banana-pro` | 2026-11-12 | A scanned 1932 American railroad passenger ticket stub, cream card stock with red and black letterpress printing, reading 'THIRD CLASS', 'DEC 24 1932', destination printed as 'DESTINY GATE', punch holes, serial number, worn edges, flat scan on black. |

## Audio (86)

| id | endpoint | date | prompt / source |
|---|---|---|---|
| `a_amb_abyss` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Wind rushing up from a deep chasm beneath a speeding train, steel rails screaming far below, hollow roar. |
| `a_amb_arena` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Vast iron machine hall inside a speeding train: heavy sub-bass engine drone, wind howling through steel shafts, tensioned cables groaning, distant pistons. No voices, no music. |
| `a_amb_nightmare` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Interior of a train carriage in a nightmare: slowed, stretched, irregular asymmetric wheel impacts, hollow metallic resonance, deep sub rumble, long unnatural reverb, eerie. No voices, no music. |
| `a_amb_passengers` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Very quiet murmur of a few passengers in a 1930s railway carriage, an occasional cough, wool coat rustle, a newspaper page, faint glass rattle. |
| `a_amb_station` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Enormous cavernous underground railway station at night: deep reverberant wind, very distant trains passing on many levels, far steam hiss, lonely vast space. |
| `a_amb_train` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Interior of a 1930s steam train passenger carriage at night: steady rhythmic iron wheels clacking over rail joints, low rolling rumble, gentle wooden carriage creaks, roof resonance. No voices, no music. |
| `a_amb_whispers` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Isolated ghostly whispers echoing in an empty railway carriage, unintelligible, sparse, breathy, filtered as if through a wall. |
| `a_blackout` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Electric lights cutting out with a heavy clunk and a dying hum, then silence. |
| `a_breath_hurt` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A frightened man's shaky laboured breathing, close. |
| `a_cable_pull` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A steel cable yanked hard through a pulley with a ratchet. |
| `a_cable_return` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A spring-loaded handle snapping back with a short ratchet rattle. |
| `a_cloth` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Short wool coat rustle as a man moves. |
| `a_collapse_metal` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An iron floor grating breaking loose and crashing down a deep shaft, metal debris clattering away below. |
| `a_collapse_trap` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One decisive enormous hybrid orchestral and mechanical impact: a massive iron structure and counterweight collapsing, deep sub boom, long dark tail. |
| `a_collapse_wood` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Wooden bridge planks snapping and collapsing into a deep chasm, debris tumbling away into the distance. |
| `a_crack_critical` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A rapid chain of sharp tearing cracks, wood and metal splitting apart, urgent, accelerating. |
| `a_crack_stress` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Hairline cracks spreading slowly through a floor: quiet creaking, fibres tearing, dust trickling. |
| `a_crack_tick_1` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One single sharp brittle crack of wood splintering, dry, short. |
| `a_crack_tick_2` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One single sharp brittle crack of wood splintering, dry, short. |
| `a_crack_tick_3` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One single sharp brittle crack of wood splintering, dry, short. |
| `a_door_forced` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A metal latch smashed off by a heavy iron wrench, then a wooden door bursts open. |
| `a_door_open` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Old wooden railway carriage door unlatching with a brass handle and creaking open. |
| `a_door_slam` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Heavy iron door slamming shut and a bolt dropping, reverberant. |
| `a_fall_yell` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A man's short yell as he falls, fading downward. |
| `a_fs_metal_1` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on an iron grating walkway, slight metallic ring, close microphone. |
| `a_fs_metal_2` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on an iron grating walkway, slight metallic ring, close microphone. |
| `a_fs_metal_3` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on an iron grating walkway, slight metallic ring, close microphone. |
| `a_fs_metal_4` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on an iron grating walkway, slight metallic ring, close microphone. |
| `a_fs_stone_1` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on stone, reverberant, close. |
| `a_fs_stone_2` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on stone, reverberant, close. |
| `a_fs_wood_1` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on old wooden floorboards, dry, close microphone, slight creak. |
| `a_fs_wood_2` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on old wooden floorboards, dry, close microphone, slight creak. |
| `a_fs_wood_3` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on old wooden floorboards, dry, close microphone, slight creak. |
| `a_fs_wood_4` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A single leather-soled shoe footstep on old wooden floorboards, dry, close microphone, slight creak. |
| `a_hurt` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A man grunting in pain as he is knocked to the floor. |
| `a_lamp_flicker` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Electric lamp buzzing and flickering, filament crackle, unstable current. |
| `a_lantern_deplete` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A hiss thinning out and sputtering away to nothing. |
| `a_lantern_hiss` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Liquid glass hiss: a steady airy shimmering sizzle, soft. |
| `a_lantern_pick` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A brass and glass lantern lifted off an iron hook, soft liquid slosh. |
| `a_locked` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A stiff iron handle that will not move, short dull metallic strain and thunk. |
| `a_luggage_fall` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Heavy trunks and suitcases dropping from a height and smashing through wooden planks. |
| `a_m0` | `elevenlabs/music/v2.5` | 2026-11-12 | Sparse, fragile solo felt piano motif of a few notes with long silences, distant bowed glass harmonics, very quiet and melancholic, intimate, 1930s memory, slow, no drums. |
| `a_m1` | `elevenlabs/music/v2.5` | 2026-11-12 | Dark ambient horror underscore: detuned string drone, a slow irregular low pulse slightly out of time like a limping train rhythm, uneasy, restrained, no melody, no drums. |
| `a_m2` | `elevenlabs/music/v2.5` | 2026-11-12 | Suspense underscore: sustained dissonant string clusters, sparse metallic percussive ghosts and scrapes, quiet, searching, tense, lots of space, no melody. |
| `a_m3` | `elevenlabs/music/v2.5` | 2026-11-12 | Horror chase music: short driving rhythmic low string ostinato, pounding processed mechanical percussion like train pistons, rising insistent propulsion, aggressive but not loud in the high frequencies, no melody. |
| `a_m4` | `elevenlabs/music/v2.5` | 2026-11-12 | Tense anticipation: held high string harmonics with no bass at all, a ticking pocket watch rhythm, breath held, very sparse, waiting. |
| `a_m5` | `elevenlabs/music/v2.5` | 2026-11-12 | Aftermath: begins with near silence and a low sustained note, then a subdued tender theme on low strings and felt piano slowly emerges, bittersweet, mysterious, unresolved, cinematic, slow. |
| `a_mad_breath` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Muffled laboured breathing through thick canvas, leather straps and buckles creaking, distant muffled trapped voices, horror. |
| `a_mad_charge` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A short buckle-release snap followed by a sharp narrow inhale of breath, attack anticipation. |
| `a_mad_fall` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A muffled scream falling away down a deep shaft and transforming into a reversed steam train whistle. |
| `a_mad_gate` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An iron cage gate being wrenched and torn open, screeching metal. |
| `a_mad_lunge` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An explosive violent rush of heavy cloth and whipping leather straps. |
| `a_mad_pound` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Something very heavy pounding three times on an iron door from the other side, reverberant. |
| `a_mad_scream` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An anguished scream muffled inside a padded cell, canvas-muffled, inhuman, horror creature. |
| `a_mad_stagger` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A pained muffled grunt and buckles rattling as a large creature staggers. |
| `a_mad_step_1` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One heavy padded footstep with a leather strap dragging and a buckle jingle. |
| `a_mad_step_2` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One heavy padded footstep with a leather strap dragging and a buckle jingle. |
| `a_mad_step_3` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One heavy padded footstep with a leather strap dragging and a buckle jingle. |
| `a_mad_stumble` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A large creature scrabbling for footing as a metal grate gives way, straps flailing, grate clanging. |
| `a_mad_ticks` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Three staggered sharp ticks of wood and metal, then a slow breath-like compression of thick heavy cloth, ominous warning. |
| `a_paper` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An old paper photograph picked up and turned over. |
| `a_pickup` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A small brass object picked up, soft metallic handling. |
| `a_pin_pull` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A thick steel pin dragged out of its housing with grinding metal, then a deep clunk as a massive counterweight shifts on chains overhead. |
| `a_reveal` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A soft glassy shimmer as something hidden becomes visible, subtle. |
| `a_settle` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A strained structure settling back: fading creaks, electrical hum returning, relief. |
| `a_sting` | `elevenlabs/music/v2.5` | 2026-11-12 | Dramatic end title sting: deep brass and low strings swell into one majestic ominous chord with a reversed steam whistle, then a long dark reverb tail. |
| `a_stretch` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A wooden door frame stretching impossibly: deep groaning timber under strain, creaking, eerie rising pitch. |
| `a_tension` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A tensioned steel cable and iron structure creaking under extreme load, critical metallic strain. |
| `a_title` | `elevenlabs/music/v2.5` | 2026-11-12 | Main title theme for a noir psychological horror set in 1932: slow mournful solo cello melody over a distant slow train rhythm in low strings, lonely muted trumpet answer, cinematic, restrained, haunting. |
| `a_ui_hover` | `elevenlabs/sound-effects/v3` | 2026-11-12 | One very soft small brass tick. |
| `a_ui_select` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A soft mechanical click of a railway ticket punch. |
| `a_ui_start` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A distant steam train whistle and a long release of steam, lonely. |
| `a_victory_whistle` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A reversed steam train whistle swelling and fading into a distant empty station platform. |
| `a_vo_conductor_1` | `elevenlabs/tts/eleven-v4` | 2026-11-12 | Next station... Harlan Junction. Next station. |
| `a_vo_conductor_2` | `elevenlabs/tts/eleven-v4` | 2026-11-12 | Next station... next... station... |
| `a_vo_mitchell` | `elevenlabs/tts/eleven-v4` | 2026-11-12 | [whispering] I have to get home. [pause] I have to stop myself. |
| `a_watch_cast` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A pocket watch mainspring winding very fast, then a clear resonant brass chime. |
| `a_watch_expire` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Watch ticking that accelerates rapidly then a sharp spring snap. |
| `a_watch_noecho` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A dull hollow muffled thud of a clock mechanism failing to catch, short, empty. |
| `a_watch_ready` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A soft brass click and one clear watch tick. |
| `a_watch_rewind` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Time rewinding: a reversed wound-spring motif, reversed ticking and a shimmering backwards whoosh, magical but mechanical. |
| `a_watch_tick` | `elevenlabs/sound-effects/v3` | 2026-11-12 | Steady close mechanical pocket watch ticking, slightly filtered. |
| `a_wrench_body` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A heavy blunt thud of iron hitting thick padded canvas, muffled impact. |
| `a_wrench_clank` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A heavy iron wrench striking a steel railing, loud ringing clank. |
| `a_wrench_latch` | `elevenlabs/sound-effects/v3` | 2026-11-12 | An iron lever being forced with a heavy wrench: weighty groan of leverage then a crisp metallic click. |
| `a_wrench_swing` | `elevenlabs/sound-effects/v3` | 2026-11-12 | A heavy iron tool swung fast through the air, short whoosh. |
