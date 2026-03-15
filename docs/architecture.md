# Architecture

This document captures the core architecture of the system at the level of musical analysis and representation.

The system starts from basic authored musical input.

It analyzes that input through harmonic, melodic, and continuity-based processes, using natural rounding to stabilize and connect the material across time.

This produces two main derived structures:

- a harmonic structure, which forms the harmonic field and stave-like framework.
- a melodic structure, which forms the musical line within that framework.

These are then combined into a single coherent musical representation.

## Authored input methods (Exploratory)

Previous iterations explored several authored input methods that can all be understood as compiling into the same canonical input model before analysis. These include a compact symbolic score language, a direct structured data model, and a rolling note-stream model.

The compact symbolic score language is the most explicitly musical of these approaches. In that form, a piece is entered as a sequence of usually bar-like segments, each with optional harmonic labeling followed by authored events. Single notes, grouped simultaneous notes, and explicit gaps are entered textually. Octave is marked lightly rather than through full absolute pitch notation. This makes the format efficient to write, scan, and revise by hand.

The direct structured data model is the most explicit and deterministic. In that form, the piece is already written as arrays or objects containing bars or segments, one or more lines of event material, durations, notes, rests, and optional harmonic hints. Some variants also included explicit presentational conveniences such as pre-authored harmonic block hints. This reduces ambiguity at the authored level and keeps the input immediately machine-readable, but it still compiles into the same broad canonical model.

The rolling note-stream model is the sparsest approach. In that form, the system receives recent note material over time and infers a sequence of local musical states from that stream. This approach does not provide explicit authored harmonic guidance in the same way, but it demonstrates that harmonic unification can still begin from sparse or unlabeled musical evidence.

Taken together, the archived codebases explored input at three different levels of explicitness:

- text-first input, where musical material is authored as a compact symbolic score
- structure-first input, where musical material is authored directly as data
- evidence-first input, where musical material is supplied as recent note activity and local states are inferred from it

They also explored different balances of authored guidance. Some inputs provided only event material. Some added harmonic hints. Some added stronger structural aids such as authored block cues. Some included piece-level metadata such as coarse time-grid declarations, height hints, or global flags that bias harmonic completion. Across all of these variants, the key architectural point is that the authored form may vary substantially while still compiling into the same canonical pre-analysis model.

The exact authored input language therefore remains open so long as it can be normalized into the same pre-analysis model of piece, segments, events, and optional harmonic hints. Harmonic hints may be lightweight or rich. They may include roots, accidentals, extensions, alterations, suspensions, augmented and diminished cases, and slash-bass forms. Octave may be authored explicitly or marked only lightly. Event structure may be entered as one primary line, two coordinated layers, or a line with small simultaneities. These are all valid points of exploration above the same underlying input model.

## Canonical input model (Foundational)

The canonical input to the analysis process is a unified, canonicalized musical input model. Across the previous codebases, this converges on a simple structure:

- `piece`
- ordered `segments`
- `events` within each segment
- optional `harmony_hint` on each segment

This model is intentionally thinner than the analyzed model. It preserves authored musical facts and harmonic guidance, but not derived harmonic structure. It is the form analysis actually wants, regardless of how the music was originally entered.

A `piece` is the whole authored musical object entering analysis. It is the top-level ordered container for the rest of the input and does not yet carry derived harmonic regions, guides, motion summaries, or other analytical results.

A `segment` is the core local unit of input. Earlier versions often used bars for this, but the deeper architectural unit is a segment: large enough to carry local harmonic identity, small enough to participate in continuity-based smoothing across time. A piece is therefore an ordered sequence of segments, and segment order is authored fact. A segment may also carry lightweight local metadata such as harmonic hints or other authored cues that shape later analysis without replacing it.

An `event` is the explicit musical content inside a segment. Across the previous codebases, events consistently reduce to note events, rest or gap events, and simultaneous note groups. Events carry authored pitch tokens and durations. They may be positioned by sequence or local time within a segment. They preserve explicit silence as authored content and preserve local simultaneity directly rather than requiring either to be reconstructed later.

`harmony_hint` is the optional authored harmonic guidance attached to a segment. It seeds analysis, but it remains input rather than result. It does not replace the need to analyze explicit events, and it does not carry derived harmonic geometry by itself.

This model captures what persisted across the previous systems. Bars are one common kind of segment. Grouped notes are one kind of event. Silence is an event. Octave markings live inside authored pitch tokens. Multiple visible lines in an authored score reduce here to event organization inside segments rather than to a separate canonical voice model. Canonical input therefore stays simple: a piece made of ordered segments, each containing events and optionally harmonic hints.

The canonical model also preserves the key distinctions needed by later analysis:

- authored facts vs derived structure
- local segment identity vs cross-segment continuity
- single events vs simultaneous groups
- explicit silence vs missing information
- harmonic guidance vs explicit event content

These distinctions were all used somewhere in the earlier codebases even when the authored formats differed. The canonical model keeps them intact while stripping away format-specific detail.

In practice, this means the canonical input is neither raw notation nor already-analyzed theory. It is structured authored musical evidence. Notes are still authored notes, not yet harmonic roles. Harmony hints are still hints, not yet harmonic beds. Register may still be lightly specified rather than fully resolved. Piece-level metadata may still exist, but only as authored guidance. All richer harmonic, structural, and representational meaning is deferred to later stages.

This canonicalization step is important in its own right. The previous codebases already imply that authored music may arrive in different forms but should enter harmonic unification in one stable shape. The canonical input model is that stable shape: the shared interface between authored music and harmonic analysis.

## Harmonic evidence (Foundational)

Harmonic unification is the primary analytical task of the system. It takes the full richness of the canonical input and resolves it into a coherent harmonic bed. The first step is drawing together all possible harmonic evidence from the input.

Harmonic evidence includes explicit event content, simultaneities, optional harmonic hints, and surrounding context. It is not limited to labels. It includes the actual notes present in a segment and, where relevant, the neighboring material that helps stabilize weak local evidence.

This means that harmonic evidence can come from several sources at once:

- authored harmonic hints
- explicit pitch content inside events
- local simultaneities
- the immediate segment-level collection of active notes
- neighboring segments when local evidence is weak or incomplete
- recent note history in systems that infer a changing harmonic frame from streams of notes

In the richer analysis branches, harmonic evidence also includes information derived from the relation between authored hints and explicit events. Chord labels contribute one candidate note set. Explicit notes contribute another. Melody can add harmonic evidence even when it is not itself a harmonic hint. Simultaneous groups can act as compact local harmony. The local note collection of a segment can therefore differ from the hinted harmony and still be part of the same evidence pool.

The previous codebases suggest that harmonic evidence is gathered at several granularities at once. There is the event level, where individual notes and rests appear. There is the simultaneity level, where small note groups can function as compact vertical harmonic evidence. There is the segment level, where all active pitch content inside a segment contributes to one local harmonic state. There is the neighboring-segment level, where what comes before and after can strengthen or weaken a local reading. And in the most streaming-oriented versions, there is a rolling-history level, where the recent note window itself becomes harmonic evidence.

The evidence pool can therefore contain both explicit and implied harmonic material. Explicitly present pitches matter. But hinted harmony matters too. Bass indications matter. Missing but strongly implied defining tones matter once enough evidence exists to support them. Even when the codebases differed in exactly how these sources were weighted, they consistently treated harmonic evidence as broader than whatever was literally named or literally sounding at one instant.

Across the earlier systems, the harmonic evidence drawn from canonical input commonly included:

- literal pitch material from note events
- silence and absence as meaningful part of the local event pattern
- simultaneities as compact local harmonic clues
- segment-level pitch collections formed from all active note content
- harmonic hints such as chord labels and slash-bass forms
- locally implied chord tones suggested by those hints
- neighboring persistence or contradiction across adjacent segments
- recent-note accumulation in more stream-oriented approaches
- the relation between hinted harmony and explicit event content when the two did not fully agree

The system therefore draws harmonic evidence as broadly as possible before deciding what the harmony is. This is one of the strongest convergences across the previous codebases. Harmonic evidence is not a single source and not a single layer. It is the total harmonic content that can be responsibly drawn from canonical input before enrichment begins.

The important convergence across the previous codebases is that the system consistently tries to draw as much harmonic evidence as possible from the input before settling harmonic understanding. Harmonic unification is therefore evidence-hungry by design. It does not privilege chord labels to the exclusion of notes, and it does not treat surface events as irrelevant once hints are present.

## Harmonic enrichment (Exploratory)

The main exploratory area is harmonic completion and enrichment: how harmonic evidence is drawn together into a fuller harmonic understanding before the final harmonic structure is settled.

Across the previous codebases, several distinct enrichment routes were tried for moving from canonicalized input to settled harmonic structure.

One route starts from harmonic hints and expands them into functional note content. In this approach, a hint is not treated as a display label but as compressed harmonic information. Quality, extensions, alterations, suspensions, bass implications, and missing defining tones all contribute to the local harmonic reading. Some versions also allowed global bias flags or piece-level settings to make fifth-completion more permissive across the whole piece.

Another route starts from the local note collection itself. In that approach, the active notes in a segment, including simultaneities and melodic notes, are treated as the primary harmonic evidence. The system then searches directly for core note content, guide content, regions, and special-case harmonic shapes without relying on a named chord as the primary source of truth.

A third route starts from recent note history. In that approach, the system builds a changing harmonic frame from a rolling window of recent notes rather than from explicit segment-level harmonic hints. This was explored most strongly in the earlier key-tracking prototype and shows that harmonic structure can emerge from note history alone.

These routes were not always exclusive. In some branches, harmonic hints, explicit pitch content, and contextual persistence all contributed candidate harmonic material at once. The enrichment stage then had to reconcile them rather than choose only one source as authoritative.

Probable-fifth completion is a recurring enrichment strategy across several branches. In those versions, a fifth could be treated as structurally present even when not explicitly given, then either confirmed or withheld by surrounding context, by the local note collection, or by broader piece-level settings.

Root and base inference also belong here. In some branches, root and bass could be read directly from harmonic hints. In others, they had to be derived from the enriched pitch content, from likely fifth relationships, or from how the local harmonic geometry was being organized. Some versions treated root and base as paired grounding positions rather than as a single absolute point.

Contextual completion is also central. Weak local evidence can be enriched by neighboring segments. Notes can be propagated across time. Guides can be inferred from before and after a segment. Local harmonic readings can be stabilized by what persists around them. Some versions ran several enrichment passes until the local and contextual readings stopped changing, effectively treating harmonic enrichment as an iterative convergence process rather than a single calculation.

Guide inference is one important subfamily of enrichment. In the richer analytical branch, guide content was sometimes derived not only from what is present locally, but from what is stable across nearby segments and not contradicted on both sides. This made guides a partially contextual result rather than a purely local extraction.

Block and region discovery were also part of enrichment in several branches. Rather than beginning from a ready-made harmonic bed, the system often had to derive candidate rails, spans, or blocks from enriched pitch content. This included searching for contiguous alternating-note spans, deciding whether one or two principal regions were present, and recognizing when the local harmony behaved like an augmented-like, diminished-like, or otherwise special-case structure.

Geometric and center-seeking strategies were used where several equivalent local harmonic readings were available. Earlier systems sometimes chose among candidate rail or block realizations by minimizing displacement, preserving parity, or balancing simultaneous spans. Others estimated local middles or average harmonic centers from surrounding segments and used those to settle local harmonic readings. Some branches also rotated pitch collections into canonical fifth-space alignments before selecting structural organization. In the earliest key-tracking prototype, the system even tried to fit the local fifth-collection to compact key-like patterns, then allowed partial fits with one tone omitted before falling back to a circular center estimate when no cleaner fit existed.

Motion has sometimes been treated as part of this same enrichment process. In those cases, newly present tones are compared with prior segments, nearest predecessors are found, and small-step tendencies are used to stabilize the harmonic reading. This is less a separate architecture than one more way of enriching weak local harmonic understanding.

The exact intermediate objects used during enrichment have also varied. Previous codebases experimented with expanded harmonic note sets, chord-note subsets, guide-note subsets, probable-fifth sets, root and base candidates, local harmonic centers, motion sets, cover and extension sets, and candidate rails or blocks before settling the final harmonic structure. Some branches made heavier use of symbolic intermediate forms, while others used more geometric or pitch-space-oriented ones.

Across all of these variants, the open question is not whether harmonic enrichment happens, but how it should happen. The previous codebases explored several methods for doing it, and that remains the main area of live exploration between canonicalized input and canonicalized harmonic structure.

## Harmonic structure (Foundational)

The result of harmonic unification is generated harmonic structure. Across the previous codebases, this converges relatively consistently on regions or blocks together with root and base grounding.

The regions or blocks may take ordinary or special-case forms, but they consistently serve as the main harmonic bed. They are the main generated harmonic framework rather than a decorative overlay. In the previous systems this framework was repeatedly understood as spatial rather than merely symbolic: something the rest of the music could inhabit rather than just a label attached above it.

Within that framework, the structure distinguishes core or guide content from outer or extension space. Core or guide content captures the structurally central harmonic material. Outer or extension space captures the surrounding contextual or continuation space that still belongs to the field without being part of its innermost core. In some systems this appeared as inner and outer spans, in others as guides plus blocks plus extensions, but the underlying distinction remained the same.

Across the archived codebases, the harmonic bed often resolved into one or two principal regions, rails, spans, or blocks. In some cases these were broad regions with interior and exterior layers. In others they collapsed into thinner line-like structures that still represented the same underlying field. In still others they appeared as more abstract key-frame bands or repeated harmonic strips. These variants differ in presentation, but the converged structural idea is the same: the harmonic output is a bounded, spatial field with a small number of principal organizing parts.

Root and base provide the main grounding. In some cases an implied fifth also plays a structural role. Together, these grounding elements orient the harmonic field without reducing it to a single symbolic label.

In the more developed analytical branch, root and base were not only local labels but part of a continuous grounding structure. Earlier systems sometimes treated them as paired positions that were themselves carried through neighboring segments by choosing the closest compatible realization. This reinforces that grounding is part of the harmonic bed, not merely an annotation attached to it.

The resulting harmonic structure forms the structural bed of the music and can function as the stave-like framework within which subsequent musical placement occurs. This is one of the strongest convergences across the previous systems: harmony is not merely named, it is generated as a field the rest of the music can inhabit.

That harmonic bed is also continuous in intention even when segmented in data. The previous systems repeatedly tried to keep neighboring local structures aligned into a coherent through-line. Harmonic structure was therefore not only a per-segment classification, but a local field shaped so that adjacent fields could connect, persist, or smoothly transform across time.

The harmonic bed also carries more than one kind of structural information at once. It may simultaneously express:

- principal regions or blocks
- guide or core content within those regions
- outer or extension space around that core
- root and base grounding
- implied fifth support where relevant
- special-case harmonic shape such as augmented-like or diminished-like behavior
- local continuity relations with neighboring segments

In the simpler score-like branches, these appeared as background blocks, interior spans, and note positions inside them. In the richer analytical branches, they appeared as guides, blocks, cover, extension, root, base, and moves. In the earliest prototype, they appeared as a continuously updating harmonic frame or key-like field. These are all different views of the same deeper harmonic output.

This harmonic structure is foundational not only because it is generated, but because it is generative. It becomes the basis for later melodic placement, for continuity of leading, and for final rendering. Events and lines are not merely drawn on top of it; they are placed within it. Rendering does not invent the structure; it projects it.

The deeper principle running through harmonic structure is canonicalization. The system does not only extract harmonic structure, it settles harmonic understanding into a stable analytical form. This includes local classification, continuity across neighboring segments, normalization into a coherent local frame, and choosing among musically equivalent structural realizations. In the richer analytical branches, this meant actively shifting guides, blocks, and root/base pairs into the closest compatible realization from one segment to the next so that equivalent structures stayed visually and analytically continuous rather than jumping between octaves or rotations. Graceful fallback is part of the same principle. If harmonic hints are absent, structure can be inferred from events. If evidence is weak, context can stabilize it. If no clear harmonic structure emerges, ambiguity can be preserved rather than forced into a false reading. The system therefore aims not just to identify harmony, but to settle it into a stable harmonic bed.


## Melodic placement (Exploratory)

Once harmonic structure has been generated, authored events are carried back into that structure as actual musical material. This is the leading or melodic placement stage.

At this stage, the system works from the authored event layer of the canonical input model together with the generated harmonic bed. Notes, rests, simultaneities, and durations are preserved as authored facts, but they are no longer treated as free-floating input. They are situated within the harmonic structure as concrete musical material.

This stage includes resolving pitch or register placement where needed, preserving continuity of the line, and allowing leading behavior to shape how events move through the harmonic framework. Earlier versions repeatedly chose nearest sensible continuations, let the line remain readable as a continuous path rather than as isolated events, and allowed local leading tendencies or small-step movement to influence how the event layer was carried through the harmonic bed. In the richer analytical branch, this could narrow all the way down to semitone-leading behavior, where newly active tones were compared with nearby prior harmonic content and only the smallest moves were treated as structurally significant.

This stage also includes settling usable local bounds for placement. In the richer analytical branch, the available space for events was not fixed independently of the music; it was shaped by both the harmonic bed and the local melodic range. These bounds were often centered from local and nearby melodic midpoints rather than from a fixed page register. This meant that melodic placement was constrained by the harmonic field but not mechanically trapped by it. The line could be given enough space to remain legible while still living inside the generated harmonic structure.

In the richer analytical branches, melodic placement was not only about drawing the notes. It also involved carrying forward some generated line-level structure. Authored pitch tokens could be extended into actual register-resolved note placement. Local event groups could become a more continuous melodic path. Newly present tones could be related to what came before. In some branches, motion or leading information was explicitly tracked so that the event layer was shaped by small-step behavior, nearest predecessors, or continuity against the harmonic frame.

Multiple authored layers were also handled here. Some codebases worked with one primary line. Others worked with two visible lines that still sat within the same harmonic field. In those cases, melodic placement included deciding how each line should sit relative to the harmonic bed, how their event material should remain legible, and how continuity should be preserved across both.

Rests remained part of this stage as well. In some score-like versions, even rests inherited a local vertical placement from the surrounding line or framework so that silence remained legible inside the same musical space. This reinforces that melodic placement is not only about sounding pitches; it is about placing authored event material as a whole inside the harmonic structure.

The output of this stage is therefore more than harmonic structure and more than raw event data. It is the combined musical object that results when authored events are led into a previously unified harmonic field. Harmonic structure remains the bed, but the event layer now has concrete line, position, and continuity within that bed.

## Rendering (Exploratory)

Once harmonic structure and led event material have been brought together, what remains is rendering or projection: the choice of how that unified musical object is made visible.

The key underlying idea is that rendering happens only because the system is treating the result as one coherent thing rather than as separate harmonic and event diagrams. That unity is a guiding principle of projection. It means the final output should read as one musical object whose harmonic bed and event material belong to the same structure. What remains exploratory is not that unity itself, but how exactly that object should best be made visible once harmonic structure has been generated and events have been led into it.

This is the main downstream area of exploration. Several projection styles remain open above the same analyzed model.

One style is the abstract harmonic-stave approach. In that form, the harmonic bed is rendered as rails, spans, or layered regions, and event material is positioned against that field. This pushes furthest toward an analytical score-language in which the harmonic framework itself acts as the main visual substrate.

Another style is the block-based score approach. In that form, harmonic regions appear as background structures while event material is rendered with more recognizable noteheads, rests, stems, and duration markings. In the more developed examples, connected harmonic shapes stretch across adjacent bars while note-level detail remains visible inside them.

A third style is the evolving key-frame or strip-based approach. In that form, harmonic identity is shown through repeating horizontal bands, intensity changes, or shifting offsets over time. In that prototype, the visible frame could retain memory of nearby harmonic content rather than resetting cleanly each segment, so persistence was conveyed through gradual change in the rendered field itself. Harmonic components could brighten, fade, and accumulate according to recent activity, making continuity visible as changing intensity rather than only as repeated shape. This is the most abstract of the explored routes, but it still serves the same purpose: making harmonic continuity and local event placement visible inside one coherent frame.

The previous codebases also explored different balances between how much of the harmonic bed is rendered directly and how much is implied. Some versions relied more heavily on explicit blocks, rails, or spans. Others relied more on note placement and local cues against a lighter harmonic field. Some used authored harmonic block hints to guide projection. Others derived everything from the generated harmonic structure itself. Some renderers also made a distinction between broad and thin structural variants, allowing the same underlying harmonic object to appear either as a fuller region or a more line-like span when its structure collapsed toward a single track.

Projection also includes the perceptual cues used to expose harmonic identity and continuity. Previous iterations explored color derived from harmonic identity in fifth-space, often after rotating pitch collections into a canonical fifth-oriented frame; connected shapes that make harmonic persistence visible; explicit noteheads and rests placed inside non-conventional harmonic frames; line thickness and span thickness effects; and different balances between event notation and abstract harmonic framing.

Continuity itself is also a rendering concern. The archived systems explored making continuity visible not only by preserving content, but by visibly connecting neighboring harmonic shapes, carrying rails smoothly across segment boundaries, and allowing event placement to read as one through-line rather than as isolated local states. This suggests that rendering is responsible not only for showing the musical object, but for showing its settled continuity across time.

The rendering experiments also varied in how much conventional notation language they retained. Some projections preserved recognizable noteheads, rest symbols, stems, and duration distinctions while placing them inside a non-conventional harmonic framework. Others moved further toward analytical marks, rails, blocks, or bands. This means the rendering problem is not simply conventional notation versus abstraction. The explored space already shows a spectrum of possible projections above the same musical content.

What remains consistent across all of these approaches is the goal. The final output should present one coherent musical object rather than separate harmonic and event diagrams, and it should expose harmonic identity, continuity, and event placement through coherent perceptual cues rather than arbitrary decoration.
