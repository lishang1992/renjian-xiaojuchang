import {
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { AssetsPage } from './pages/AssetsPage';
import { CharactersPage } from './pages/CharactersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScriptEditorPage } from './pages/ScriptEditorPage';
import { ScriptsPage } from './pages/ScriptsPage';

const navigation = [
  { to: '/', label: '今日工作台', icon: LayoutDashboard, end: true },
  { to: '/scripts', label: '剧本与分镜', icon: Clapperboard },
  { to: '/characters', label: '固定人物', icon: UsersRound },
  { to: '/assets', label: '素材库', icon: FolderOpen },
];

function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>人间小剧场</strong>
            <span>短剧制作工作台</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="主导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <p>生活很难，</p>
          <p>但故事总有答案。</p>
          <span>本地创作，素材只保存在这台电脑</span>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="page">
      <div className="empty-state">
        <h2>这个页面不存在</h2>
        <p>返回今日工作台，继续写你的故事。</p>
        <NavLink className="button button-primary" to="/">
          返回工作台
        </NavLink>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="scripts" element={<ScriptsPage />} />
        <Route path="scripts/:scriptId" element={<ScriptEditorPage />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
