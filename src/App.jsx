import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "./ui/AppLayout";
import Home from "./pages/Home";
import ErrorPage from "./pages/ErrorPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import AnimePage from "./pages/AnimePage";
import Player from "./pages/Player";
import NewReleases from "./pages/NewReleases";
import BrowseAnime from "./pages/BrowseAnime";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Downloads from "./pages/Downloads";
import AnilistAuthCallback from "./components/AnilistAuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminPanel from "./pages/AdminPanel";

// import { lazy } from "react";
// const AnimePage = lazy(() => import("./pages/AnimePage"));
// const Player = lazy(() => import("./pages/Player"));

// Vercel deployment için basename: '/', production için basename: '/'
const basename = '/';

const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      errorElement: <AppLayout props={<ErrorPage />} />,
      children: [
        {
          path: "/",
          element: <Home />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/anime/:animeId",
          element: <AnimePage />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/player/:magnetId/:animeId?/:priorProgress?/:currentEpisodeNum?",
          element: <Player />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/newreleases",
          element: <NewReleases />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/browse",
          element: <BrowseAnime />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/downloads",
          element: <Downloads />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/login",
          element: <Login />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/register",
          element: <Register />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/profile",
          element: <Profile />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/edit-profile",
          element: (
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          ),
          errorElement: <ErrorPage />,
        },
        {
          path: "/anilistauthcallback",
          element: <AnilistAuthCallback />,
          errorElement: <ErrorPage />,
        },
        {
          path: "/admin",
          element: (
            <AdminProtectedRoute>
              <AdminPanel />
            </AdminProtectedRoute>
          ),
          errorElement: <ErrorPage />,
        },
      ],
    },
  ],
  {
    basename: basename,
  },
);


function App() {
  // the idea of integrating react-query is similar to that of context api

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 dakika - API isteklerini cache'le
        cacheTime: 10 * 60 * 1000, // 10 dakika - cache'de tut
        refetchOnWindowFocus: false, // Pencere odaklandığında tekrar fetch yapma
        retry: 1, // Hata durumunda sadece 1 kez tekrar dene
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
