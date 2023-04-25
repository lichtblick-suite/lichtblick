constraints_min_version(1).

% Convert between an atom and a number
atom_number(Atom, Number) :-
  atom_chars(Atom, Chars),
  number_chars(Number, Chars).

% Parse an atom such as '1.2.3' into Major=1, Minor=2, Patch=3.
semver(Atom, Major, Minor, Patch) :-
  atom_chars(Atom, Chars),
  nth0(I, Chars, '.'),
  nth0(J, Chars, '.'),
  I < J,
  MinorLen is J - I - 1,
  MinorStart is I + 1,
  PatchStart is J + 1,
  sub_atom(Atom, 0, I, _, MajorAtom),
  sub_atom(Atom, MinorStart, MinorLen, _, MinorAtom),
  sub_atom(Atom, PatchStart, _, 0, PatchAtom),
  atom_number(MajorAtom, Major),
  atom_number(MinorAtom, Minor),
  atom_number(PatchAtom, Patch).

% True if Major1.Minor1.Patch1 is less than Major2.Minor2.Patch2
semver_less(Major1, Minor1, Patch1, Major2, Minor2, Patch2) :-
  Major1 < Major2;
  Major1 == Major2, Minor1 < Minor2;
  Major1 == Major2, Minor1 == Minor2, Patch1 < Patch2.

% Find the maximum version in a given list of semver atoms, e.g. semver_max(['1.0.0', '2.0.0'], '2.0.0').
semver_max([Version], Version).
semver_max([First|Rest], Result) :-
  semver_max(Rest, RestMax),
  semver(First, Major1, Minor1, Patch1),
  semver(RestMax, Major2, Minor2, Patch2),
  (semver_less(Major2, Minor2, Patch2, Major1, Minor1, Patch1) -> Result = First; Result = RestMax).


% True if Prefix occurs at the beginning of Atom.
has_prefix(Prefix, Atom) :-
  atom_concat(Prefix, _, Atom).

% Find all unique dependency versions across all workspaces that have a given Prefix, or are in
% Includes, excluding any dependencies in Excludes.
all_matching_versions(Prefix, Includes, Excludes, Result) :-
  findall(
    Range,
    (
      workspace_has_dependency(_, Dep, Range, _),
      \+member(Dep, Excludes),
      (has_prefix(Prefix, Dep); member(Dep, Includes))
    ),
    ResultList
  ),
  list_to_set(ResultList, Result).

% These dependencies are released from monorepos, so we want each package to have the same version.
% Arguments: requires_matching_versions(Prefix, Includes, Excludes)
requires_matching_versions('@storybook/', ['storybook'], ['@storybook/testing-library']).
requires_matching_versions('@typescript-eslint/', [], []).

% Enforce the requirements defined in requires_matching_versions above.
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType) :-
  write('Generating '), write(DependencyType), write(' requirements for '), write(WorkspaceCwd), nl,
  % For each existing package dependency...
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType),
  % For each monorepo that we have requirements for...
  requires_matching_versions(Prefix, Includes, Excludes),
  % If the package matches Prefix or Includes and is not one of the corresponding Excludes...
  (has_prefix(Prefix, DependencyIdent); member(DependencyIdent, Includes)),
  \+member(DependencyIdent, Excludes),
  % Find the maximum version for dependencies with this Prefix across all workspaces & packages, and
  % require this package to have that version.
  all_matching_versions(Prefix, Includes, Excludes, Versions),
  semver_max(Versions, MaxVersion),
  write('Applying maximum '), write(Prefix),write(' package version '), write(MaxVersion), write(' to '), write(DependencyIdent), nl,
  DependencyRange = MaxVersion.
