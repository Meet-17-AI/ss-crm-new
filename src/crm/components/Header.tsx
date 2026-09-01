import { useState, useRef, useEffect } from 'react'
import { User, Eye, LogOut, ChevronDown } from 'lucide-react'

/**
 * The CRM's global top bar.
 *
 * Holds the account menu, which used to sit at the foot of the sidebar. It is up
 * here because that is where every other screen in the product keeps it — the
 * panel's admin and therapist shells both put the avatar in the top right — and
 * because the sidebar footer is now the dashboard switcher's.
 *
 * Each page still renders its own title and controls below this; this bar is only
 * for things that belong to the session rather than to the page.
 */

interface HeaderProps {
  setCurrentPage: (page: string) => void
  currentUser?: any
  onLogout?: () => void
}

const Header = ({ setCurrentPage, currentUser, onLogout }: HeaderProps) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (!currentUser?.id) return;
      try {
        const profileRes = await fetch(`/api/admin-profile?user_id=${currentUser.id}`);
        if (profileRes.ok) {
          const contentType = profileRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const profileData = await profileRes.json();
            if (profileData.success && profileData.data.profile_picture_url) {
              setProfilePictureUrl(profileData.data.profile_picture_url.replace('s3.fluidjobs.ai:9002', 's3.srv1169280.hstgr.cloud:443').replace('s3.fluidjobs.ai', 's3.srv1169280.hstgr.cloud'));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    };
    fetchProfilePicture();
  }, [currentUser?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    } else {
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
  }

  return (
    <header className="flex-shrink-0 bg-white border-b px-8 py-3 flex items-center justify-end">
      <div className="relative" ref={profileMenuRef}>
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          aria-haspopup="menu"
          aria-expanded={showProfileMenu}
          className="flex items-center gap-3 rounded-lg border p-2 pr-3 transition-colors hover:bg-gray-50"
        >
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt="Profile"
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 bg-orange-400 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
          )}
          <div className="hidden text-left leading-tight sm:block">
            <div className="font-semibold text-sm text-gray-900">{currentUser?.full_name || currentUser?.username || 'User'}</div>
            <div className="text-xs text-gray-600">Role: {currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Admin'}</div>
          </div>
          <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
        </button>

        {showProfileMenu && (
          <div role="menu" className="absolute right-0 top-full mt-2 w-60 bg-white border rounded-lg shadow-lg z-50">
            <button
              role="menuitem"
              onClick={() => {
                setShowProfileMenu(false)
                setCurrentPage('settings')
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
            >
              <User size={18} className="text-gray-600" />
              <span className="text-sm font-medium">Edit Profile</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setShowProfileMenu(false)
                setCurrentPage('changePassword')
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
            >
              <Eye size={18} className="text-gray-600" />
              <span className="text-sm font-medium">Change/Forgot Password</span>
            </button>
            {/* Logout lived as a bare red icon inside the sidebar card. In a menu
                it needs a label, or the only way out of the CRM is a guess. */}
            <button
              role="menuitem"
              onClick={() => {
                setShowProfileMenu(false)
                handleLogout()
              }}
              className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-red-600"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
