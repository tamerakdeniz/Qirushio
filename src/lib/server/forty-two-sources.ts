import "server-only";

import type { FortyTwoQuizCategory, RoomSettings } from "@/lib/types";

const sharedFortyTwoContext = `
42 Turkey context:
- 42 is a tuition-free educational community based on active participation, peer learning, project work, collaboration, and creative computer science education.
- 42 Turkey opened in 2021 under the leadership of the Turkish Ministry of Industry and Technology and Bilişim Vadisi. It has 42 Istanbul and 42 Kocaeli campuses.
- 42 Istanbul is in Ayazağa Mahallesi, Azerbaycan Caddesi, Vadistanbul Ofisleri 2B Blok, 3rd floor, Sarıyer/Istanbul.
- 42 Turkey campuses operate under their own internal rules and are separate from Association 42; being a 42 Turkey student or former student does not make someone an Association 42 member.
- Status terms: Applicant is a candidate at the introduction meeting stage; Pisciner is a candidate in the Piscine; Cadet starts the main curriculum after completing the Piscine; Transcender completes Common Core and continues advanced curriculum; Alumni is inactive or completes 4.5 years in advanced curriculum; Active Alumni completed the alumni survey and is active on the alumni platform; Graduate earns the RNCP diploma; Former 42 Student did not complete Common Core.
`;

const normSource = `
Norm source notes:
- The Norm is the applicable programming standard at 42 for C projects in the Common Core by default and for any project that explicitly requires it.
- Norminette is an open-source Python checker. It checks many but not all Norm constraints. Rules marked with (*) may not be checked automatically, but can still fail a project during code review.
- Pedagogical reasons: force simple sequencing, clear architecture, readable look and feel, maintainability, and code that peers can review without first deciphering style.
- Naming: struct names start with s_, typedef names with t_, union names with u_, enum names with e_, globals with g_. Identifiers, files, and directories use lowercase snake_case with digits and underscores only. Capital letters are not allowed. Non-ASCII is forbidden except inside literal strings and chars. Names should be explicit and readable in English. Non-const/non-static globals are forbidden unless the project explicitly allows them. A file that does not compile is not expected to pass the Norm.
- Formatting: functions are at most 25 lines, not counting the function's own braces. Lines are at most 80 columns including comments. Indentation uses real tab characters visually equal to 4 characters. Braces are alone on their own line except for struct/enum/union declarations. Empty lines must contain no spaces or tabs. There cannot be two consecutive empty lines or two consecutive spaces.
- Declarations: declarations must be at the beginning of a function. Variable names are aligned in their scope. Pointer asterisks stick to variable names. One variable declaration per line. Declaration and initialization cannot be on the same line except for allowed globals, static variables, and constants. Inside a function, one empty line separates declarations from the rest; no other empty lines are allowed.
- Instructions: only one instruction or control structure per line. Assignment inside a control structure is forbidden. Commas and semicolons are followed by one space unless at end of line. Operators and operands are separated by exactly one space. C keywords are followed by a space except type keywords and sizeof. Control structures use braces unless they contain one single-line instruction.
- Functions: a function can take at most 4 named parameters. A no-argument function must explicitly use void. Prototype parameters must be named. A function can declare at most 5 variables. Return values use parentheses unless the function returns nothing. There is a single tab between return type and function name.
- Struct/typedef/enum/union: add a space after these keywords, apply usual indentation, and do not declare a structure in a .c file.
- Headers: allowed header elements are includes, declarations, defines, prototypes, and macros. Includes must be at the beginning. A C file cannot be included in a header or another C file. Headers must be protected against double inclusion; ft_foo.h uses FT_FOO_H. Unused headers are forbidden.
- 42 header: every .c and .h file must immediately begin with the standard 42 header. It must keep creator login/student email, creation date, last updater login, and last update date current.
- Macros: preprocessor constants are only for literal and constant values. Defines used to bypass the Norm or obfuscate code are forbidden. Multiline macros are forbidden. Macro names are uppercase. Preprocessor directives inside #if/#ifdef/#ifndef are indented. Preprocessor instructions are forbidden outside global scope.
- Forbidden C constructs: for, do...while, switch, case, goto, ternary operators, variable length arrays, and implicit type in declarations.
- Comments: comments cannot be inside function bodies. They must be useful, preferably English, and cannot justify bad carryall functions or obfuscated code.
- Files: a .c file cannot include another .c file. A .c file can contain at most 5 function definitions.
- Makefile: norminette does not check Makefiles, but evaluation can. Mandatory rules include $(NAME), all, clean, fclean, and re. all must be the default. Relinking unnecessarily makes the project non-functional. Source files must be explicitly listed; no *.c or *.o wildcards.
`;

const internalRulesSource = `
42 Turkey internal rules source notes:
- Internal rules bind students from the beginning of their education until it ends. Students accept the rules through the system, and later updates can also become binding after proper communication.
- Campuses are education-focused workspaces, not general rest areas. 42 Istanbul includes a 399-computer cluster, study rooms, meeting/event/student kitchen/prayer areas, staff areas, terrace, and separate restrooms. 42 Kocaeli has clusters with 182 and 157 computers across floors, student kitchen, meeting/office spaces, and common areas.
- Campus access: only registered students and approved visitors may enter. Except exceptional situations, campuses are accessible 24/7/365. Each student has a personal RFID card that cannot be lent or transferred. Lost RFID replacement costs 300 TL the first time and 500 TL after that.
- Visitor rules: a student may bring at most 2 visitors at a time if conditions are met. Requests are sent at least 1 business day / 24 hours before through the Issue System with visitor identity, date, time, and purpose. General visitors may visit only on weekdays, enter between 08:00 and 17:00, and leave by 17:00. Visitors show ID, wear visitor cards visibly, cannot use cluster computers, and the responsible student must stay with them.
- Inter-campus visits: students request visits by e-mail to the relevant Operations team at least 1 business day before. They show ID, wear and return visitor cards, follow the internal rules, and can receive TIG in their own campus for violations.
- Personal responsibility: 42 Turkey is not responsible for students' personal belongings left on campus. Students are responsible for damage they cause to people or property.
- Education process: admission starts through apply sites, online pre-selection games, introduction meeting, Piscine subscription, online check-in, identity check, completing the Piscine, and kickoff subscription. Piscine lasts 26 days and includes 14 C projects, 2 Shell projects, C rush projects, a two-person final project, 3 exams of 4 hours, and 1 exam of 8 hours. Pisciners learn through interaction and are evaluated by peers and Moulinette.
- Curriculum: after successful Piscine and final registration, candidates become Cadets. Completing ft_transcendence and Exam Rank 06 grants Transcender status. Transcenders can access specialization/professionalization projects. Alumni Launchpad freezes the level and is irreversible; it can be manual after Common Core or automatic after 8 months of inactivity after Common Core, with project delivery or work experience delaying the automatic path. Transcender status can last at most 4.5 years.
- Intra and network: Intra access requires accepting usage terms. The password is strictly personal. Black Hole can cut Intra access after one year of inactivity or disciplinary board sanctions. Black Hole is a mandatory pedagogical deadline system. Close is temporary account suspension and can be temporary campus exclusion. Freeze is a temporary education pause for unexpected or exceptional circumstances; during Freeze the student cannot access Intra or campuses and Black Hole time is delayed.
- Network and information systems: Wi-Fi/Ethernet access is free but no technical support is provided. Personal computers cannot connect to Ethernet without permission. Students must avoid illegal, harmful, copyrighted, or rights-violating data transfer, spam, service abuse, malware, unauthorized security testing, and public vulnerability disclosure without approval.
- Exam computer rules: students register through Intra. Exams take place in the cluster and last 3 to 8 hours depending on the exam. Prepared notes, smart devices, and communication are forbidden. Students must show ID and entry card; without a card entry is refused. Late entry after the exam starts is forbidden. Phones and smart watches must be off and in bags. Bags go where staff/tutors indicate. Only blank paper, pen/pencil, and water bottles on the cluster floor are generally allowed. For problems, students stand and wait for a tutor or staff member. Communication attempts are treated as cheating.
- Messaging and communication: Slack, email, and other tools must be used respectfully. Commercial advertising, political, union, or religious propaganda is forbidden on campus. Posts must show source, avoid defamation/misleading content/privacy harm, and require staff approval.
- Dress and behavior: students must avoid malicious, provocative, illegal, discriminatory, harassing, threatening, or violent behavior. Tobacco and e-cigarettes are only allowed in designated smoking areas; tobacco products/e-cigarettes cannot be left on desks.
- TIG discipline: TIG means community service work. It can be assigned by staff to compensate rule violations. Repeated failure to complete TIG can lead to suspension. Continued violations can lead to extra TIG, disciplinary board referral, and temporary or permanent exclusion.
- Example 2-hour TIG triggers: hygiene violations, food in cluster, liquid containers on cluster desks, bad-smelling food/products, trash outside bins, leaving a dirty desk, improper dress such as being shirtless/pantless/shoeless, privacy/personal-space violations, sleeping on campus, blocking emergency exits, leaving personal items outside allowed areas, leaving student card on campus, entering/exiting without card scan, running, entering restricted areas, using unavailable computers, unplugging cables without permission, shutting/restarting a computer without staff approval, connecting unauthorized devices/cables to cluster computers, and failing to perform TIG without notifying staff.
- Example 4-hour TIG triggers: smoking outside allowed areas, missing staff/Pedago appointments without 24-hour notice, leaving an accompanied visitor alone, being on campus while the account is temporarily closed except for TIG, not following staff directions, using cluster computer speakers, manipulating a session to stay open, bringing an animal without permission, missing a reserved evaluation slot, and interfering with others' evaluations without consent.
- Example 8-hour TIG triggers: consuming alcohol on campus, helping an unauthorized person enter campus, intentional misuse of campus resources, obtaining pornography via 42 Turkey network, damaging campus materials, acting under another person's identity, and helping a visitor use campus equipment/network without staff approval.
- Immediate temporary/permanent exclusion can apply for repeated TIG non-completion, persistent violations, violence against objects/animals/infrastructure, theft, illegal substances, connecting to 42 Staff/42 Dev network in the cluster, breaking Turkish law, using campus data/resources for advertising to students, cheating in exams/projects, unauthorized security tests/actions, violating project confidentiality/isolation guarantees, spreading 42 Turkey content without authorization, and physical/verbal violence toward staff or students.
- Cheating: using code not written by the student, plagiarism, passing a non-compiling/non-working project, accepting an obviously cheated project, arranging evaluation slots to get known people, unauthorized remote evaluation, bypassing Moulinette, using code outside the submitted project directory, checking a phone/electronic device during exam, exchanging information during exam, carrying prewritten-code notes, or hiding information in toilets/campus areas. Any cheating requires disciplinary board meeting and can lead to temporary or permanent exclusion.
- Disciplinary board: permanent exclusion can only be decided by the disciplinary board. It has 3 to 5 members: director and/or Pedago Lead as chair, one or two Pedago staff if available, and one or two campus staff if available. If votes tie in an even-numbered board, the chair has final decision power. Students are informed at least 5 business days before, may defend within 3 business days, may be assisted including by a lawyer, and sanctions are notified by e-mail the same or next business day at latest.
- Clubs/events: clubs must consist only of 42 Turkey students. Black Hole ends club membership; if a board member leaves, replacement must be reported within 30 days. Freeze or temporary suspension prevents club activity. Next month's events are reported in the last week of the current month with at least 7 days before the first event. Board/member lists are reported in the first 10 days of each quarter. More infrastructure-heavy events such as hackathons, LANs, competitions, or 30+ participant events require at least one month notice.
- Privacy and data: taking images in campus without clear prior consent is forbidden, and staff approval is needed to use images. Sharing images without the person and/or staff permission is forbidden. Security cameras run 24/7, cover entrances, passage areas, working areas and common student areas except restrooms, and images are kept for one month unless needed for an incident. Personal data is processed for education tracking and facility access under KVKK/GDPR rules.
- Intellectual property: 42 and 42 Turkey names, logos, slogans, domain names, educational materials, websites, databases, software, videos, and related works are protected. Unauthorized use, reproduction, modification, adaptation, translation, extraction, or reuse can lead to discipline and legal responsibility.
- Health and safety: accidents must be reported immediately to staff and if needed to 112. Students must know fire and evacuation instructions. Fire exits/corridors/stairs/windows must not be blocked; flammable/explosive/dangerous substances and unjustified use or damage of fire equipment are forbidden.
`;

const gitGithubSource = `
Git and GitHub training source notes:
- Git is the local version control tool that tracks file changes over time. GitHub is a remote hosting/collaboration platform on top of Git; it adds repository hosting, Pull Requests, review, Issues, Actions, and visibility, but does not replace Git.
- Mental model: a file moves through working directory, staging area, local repository, and remote repository. Working directory is the real folder being edited. Staging area holds changes selected for the next commit. Local repository is the commit history on the computer. Remote repository is the GitHub/GitLab copy shared with others.
- Core flow: pull current code, edit files, check status, inspect diff, add selected files, commit with a meaningful message, push to remote. Before committing, use git diff and git diff --staged as self-review.
- Setup: git config --global user.name, git config --global user.email, git config --global init.defaultBranch main, and git config --list.
- Start a repo: git init creates a hidden .git folder in a local project. git clone downloads an existing remote repository and usually sets origin.
- Important commands: git status shows changed/staged files and current branch; git diff shows unstaged line changes; git diff --staged shows staged changes; git add selects files; git commit -m creates a commit; git log --oneline shows history; git show <hash> shows a commit; git rm and git mv record deletion/rename.
- Diff reading: lines starting with - are old/removed; lines starting with + are new/added; @@ shows the changed region.
- Commit quality: a good commit is focused on one topic, has a clear message such as Implement ft_swap, is compile-ready or at least a logical checkpoint, and avoids binaries/temp files like a.out, .DS_Store, and editor artifacts. Weak messages include update, fix, final, deneme.
- Branching: git switch -c creates and switches to a new branch; git switch changes branch; git branch lists branches; git merge merges another branch into current; git branch -d removes a finished branch. Branch names should describe the task such as c01-ex02 or fix-parser.
- Remote: git remote -v shows remote URLs; git remote add origin <url> connects a local repo to a remote; git fetch downloads remote info without changing working files; git pull is fetch plus merge or rebase; git pull --rebase reapplies local commits on top of remote changes; git push sends local commits; git push -u origin branch publishes and tracks a branch.
- Undo choices depend on stage: git restore <file> discards uncommitted working-directory changes; git restore --staged <file> removes a file from staging but keeps the edit; git commit --amend rewrites the last commit; git reset --soft HEAD~1 removes last commit and keeps changes staged; git reset HEAD~1 keeps changes in working directory; git reset --hard HEAD destroys uncommitted work; git revert <hash> creates a new reverse commit and is safest for shared/public history.
- Stash: git stash or git stash push -m saves uncommitted work temporarily; git stash list lists stashes; git stash pop reapplies and removes; git stash apply reapplies but keeps it in the list. Useful before switching branch or pulling while work is incomplete.
- Conflict resolution: conflict markers show HEAD, separator, and other branch. Use git status, edit the file, remove markers, choose correct final content, compile/test, git add, then merge commit or git rebase --continue as appropriate.
- .gitignore prevents untracked generated files from entering the repo, such as a.out, *.o, *.dSYM/, .DS_Store, and .vscode/. If a file was already tracked, use git rm --cached <file> before .gitignore can stop tracking it.
- Pull Request is a GitHub review/merge discussion around branch differences. Fork is a copy under another account. Issue tracks tasks/bugs/ideas. Actions runs automated tests/build/deploy.
- Teaching emphasis: when unsure, first run git status. Speed comes from knowing where the change is: working directory, staging, local commit, or remote.
`;

const generalFortyTwoSource = `
General 42 event source notes:
- Use 42 Turkey terminology precisely: Applicant, Pisciner, Cadet, Transcender, Alumni, Active Alumni, Graduate, Former 42 Student.
- Use the core learning model: peer learning, project-based curriculum, responsibility, no cheating, self-organization, and learning by interaction.
- For presentation follow-up questions, prefer practical scenarios that test whether participants understood how rules apply, not trivia that only asks them to memorize isolated words.
- Good 42-mode questions can ask: which status applies, what action is allowed, which process is required, what a student should do before an exam/evaluation/event, or which Git command fits a stage.
`;

const categorySources: Record<FortyTwoQuizCategory, { label: string; source: string }> = {
  ft_general: {
    label: "42 Istanbul general knowledge",
    source: [sharedFortyTwoContext, generalFortyTwoSource].join("\n"),
  },
  ft_norm: {
    label: "42 Norm rules",
    source: normSource,
  },
  ft_internal: {
    label: "42 Turkey internal rules",
    source: [sharedFortyTwoContext, internalRulesSource].join("\n"),
  },
  ft_norm_internal_mix: {
    label: "Norm and internal rules mixed",
    source: [sharedFortyTwoContext, normSource, internalRulesSource].join("\n"),
  },
  ft_git_github: {
    label: "Git and GitHub training",
    source: gitGithubSource,
  },
  ft_mixed: {
    label: "Mixed 42 Istanbul event review",
    source: [sharedFortyTwoContext, generalFortyTwoSource, normSource, internalRulesSource, gitGithubSource].join("\n"),
  },
};

export function fortyTwoQuestionContext(settings: RoomSettings): string | null {
  if (settings.mode !== "fortyTwo") {
    return null;
  }

  const category = settings.category as FortyTwoQuizCategory;
  const selected = categorySources[category] ?? categorySources.ft_mixed;
  const scope =
    settings.scope === "local"
      ? "Prefer 42 Istanbul and 42 Turkey campus-specific situations from the source notes."
      : "You may use general 42 concepts only when they are explicitly present in the source notes.";

  return [
    "Game mode: 42 Istanbul post-presentation quiz.",
    `Selected 42 category: ${selected.label}.`,
    scope,
    "Use only the following source notes as authoritative facts. Do not invent campus policies, numbers, sanctions, commands, or Norm limits that are not in these notes.",
    "Prefer scenario-based questions that test understanding after a live training session. Avoid asking for obscure wording unless the number/process/rule is operationally important.",
    "For hard difficulty, combine two nearby rules or ask which action is safest/correct in a realistic situation. Still keep exactly one correct answer.",
    "Source notes:",
    selected.source.trim(),
  ].join("\n");
}
