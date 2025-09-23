import { FaGithub } from "react-icons/fa";

export const Header = () => (
  <div className="sticky top-0 z-10 border-b bg-neutral-950/90 backdrop-blur">
    <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
      <div className="font-bold tracking-wide">Poitune Next</div>
      <a
        href="https://github.com/mbinou/poitune-next"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-70 transition hover:opacity-100"
      >
        <FaGithub />
      </a>
    </div>
  </div>
);
