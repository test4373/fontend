import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getComments, createComment, likeComment, deleteComment } from '../utils/api';
import { Button } from '@radix-ui/themes';
import { HeartIcon, TrashIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { checkCommentProfanity } from '../utils/profanityFilter';

const CommentSection = ({ animeId }) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [profanityWarning, setProfanityWarning] = useState(false);
  const [profanityWarningReply, setProfanityWarningReply] = useState(false);
  const commentFormRef = useRef(null);

  const loadComments = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await getComments(animeId, pageNum);
      if (pageNum === 1) {
        setComments(response.data.data);
      } else {
        setComments(prev => [...prev, ...response.data.data]);
      }
      setHasMore(response.data.data.length === 20);
    } catch (error) {
      console.error('Error loading comments:', error);
      // Yorumlar yüklenemezse sessiz kal
    } finally {
      setLoading(false);
    }
  }, [animeId]);

  useEffect(() => {
    loadComments();
  }, [animeId, loadComments]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Profanity kontrolü
    const profanityCheck = checkCommentProfanity(newComment);
    if (!profanityCheck.isClean) {
      setProfanityWarning(true);
      return;
    }

    try {
      const response = await createComment({
        anime_id: animeId,
        content: newComment.trim(),
        parent_id: null
      });

      setComments(prev => [response.data.data, ...prev]);
      setNewComment('');
      setProfanityWarning(false);
      toast.success(t('comments.commentAdded'));
    } catch (error) {
      console.error('Error adding comment:', error);
      if (error.response?.data?.message?.includes('uygunsuz')) {
        setProfanityWarning(true);
      } else {
        toast.error(t('comments.addError'));
      }
    }
  };

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim()) return;

    // Profanity kontrolü
    const profanityCheck = checkCommentProfanity(replyText);
    if (!profanityCheck.isClean) {
      setProfanityWarningReply(true);
      return;
    }

    try {
      const response = await createComment({
        anime_id: animeId,
        content: replyText.trim(),
        parent_id: parentId
      });

      setComments(prev => prev.map(comment =>
        comment.id === parentId
          ? { ...comment, replies: [...(comment.replies || []), response.data.data] }
          : comment
      ));

      setReplyingTo(null);
      setReplyText('');
      setProfanityWarningReply(false);
      toast.success(t('comments.replyAdded'));
    } catch (error) {
      console.error('Error adding reply:', error);
      if (error.response?.data?.message?.includes('uygunsuz')) {
        setProfanityWarningReply(true);
      } else {
        toast.error(t('comments.addError'));
      }
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!isAuthenticated) {
      toast.error(t('comments.loginToLike'));
      return;
    }

    try {
      const response = await likeComment(commentId);

      setComments(prev => prev.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              likes_count: response.data.action === 'liked'
                ? comment.likes_count + 1
                : comment.likes_count - 1,
              is_liked: response.data.action === 'liked' ? 1 : 0
            }
          : comment
      ));
      toast.success(t('comments.likeSuccess'));
    } catch (error) {
      console.error('Error liking comment:', error);
      toast.error(t('comments.likeError'));
    }
  };

  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    try {
      await deleteComment(commentId);
      
      if (isReply && parentId) {
        // Yanıt silme - sadece replies dizisinden kaldır
        setComments(prev => prev.map(comment =>
          comment.id === parentId
            ? { ...comment, replies: (comment.replies || []).filter(reply => reply.id !== commentId) }
            : comment
        ));
      } else {
        // Ana yorum silme
        setComments(prev => prev.filter(comment => comment.id !== commentId));
      }
      
      toast.success(t('comments.commentDeleted'));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(t('comments.deleteError'));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const highlightMentions = (content) => {
    const sanitizedContent = DOMPurify.sanitize(content);
    return sanitizedContent.replace(/@(\w+)/g, '<span class="text-blue-400 font-medium">@$1</span>');
  };

  const scrollToCommentForm = () => {
    commentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const textarea = commentFormRef.current?.querySelector('textarea');
      textarea?.focus();
    }, 500);
  };

  return (
    <div className="mt-8">
      <h3 className="text-2xl font-bold mb-4">{t('comments.title')}</h3>

      {/* Login Prompt for Non-Authenticated Users */}
      {!isAuthenticated && (
        <div className="mb-6 p-4 bg-[#1d1d20] border border-gray-700 rounded-lg text-center">
          <p className="text-gray-400 mb-3">{t('comments.loginToComment') || 'Yorum yapmak için giriş yapın'}</p>
          <Button asChild>
            <Link to="/login">{t('auth.login')}</Link>
          </Button>
        </div>
      )}

      {/* Add Comment Form - Only for Authenticated Users */}
      {isAuthenticated && (
        <form ref={commentFormRef} onSubmit={handleSubmitComment} className="mb-6">
          <div className="flex gap-3">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'default'}`}
              alt="avatar"
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  setProfanityWarning(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (profanityWarning) {
                      // İkinci enter - direkt gönder
                      handleSubmitComment(e);
                    } else {
                      // İlk enter - küfür kontrolü yap
                      const profanityCheck = checkCommentProfanity(newComment);
                      if (!profanityCheck.isClean) {
                        setProfanityWarning(true);
                      } else {
                        // Küfür yok - direkt gönder
                        handleSubmitComment(e);
                      }
                    }
                  }
                }}
                placeholder={t('comments.placeholder')}
                className="w-full p-3 bg-[#1d1d20] border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                rows={3}
              />
              {profanityWarning && (
                <div className="mt-2 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-400 text-sm">{t('comments.profanityWarning')}</p>
                </div>
              )}
              <div className="flex justify-end mt-2">
                <Button type="submit" disabled={!newComment.trim()}>
                  {t('comments.post')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-[#1d1d20] rounded-lg p-4">
            <div className="flex gap-3">
              <img
                src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.username}`}
                alt="avatar"
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{comment.username}</span>
                  <span className="text-sm text-gray-400">{formatDate(comment.created_at)}</span>
                  {isAuthenticated && comment.user_id === user?.id && (
                    <Button
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <TrashIcon />
                    </Button>
                  )}
                </div>

                <div
                  className="text-gray-200 mb-3"
                  dangerouslySetInnerHTML={{ __html: highlightMentions(comment.content) }}
                />

                <div className="flex items-center gap-4">
                  <Button
                    size="1"
                    variant="ghost"
                    onClick={() => handleLikeComment(comment.id)}
                    className={comment.is_liked ? 'text-red-400' : ''}
                    disabled={!isAuthenticated}
                  >
                    <HeartIcon />
                    {comment.likes_count > 0 && <span className="ml-1">{comment.likes_count}</span>}
                  </Button>

                  {isAuthenticated && (
                    <Button
                      size="1"
                      variant="ghost"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      <ChatBubbleIcon />
                      {t('comments.reply')}
                    </Button>
                  )}
                </div>

                {/* Reply Form */}
                {replyingTo === comment.id && isAuthenticated && (
                  <div className="mt-3 ml-8">
                    <div className="flex gap-3">
                      <img
                        src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'default'}`}
                        alt="avatar"
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <textarea
                          value={replyText}
                          onChange={(e) => {
                            setReplyText(e.target.value);
                            setProfanityWarningReply(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (profanityWarningReply) {
                                // İkinci enter - direkt gönder
                                handleSubmitReply(comment.id);
                              } else {
                                // İlk enter - küfür kontrolü yap
                                const profanityCheck = checkCommentProfanity(replyText);
                                if (!profanityCheck.isClean) {
                                  setProfanityWarningReply(true);
                                } else {
                                  // Küfür yok - direkt gönder
                                  handleSubmitReply(comment.id);
                                }
                              }
                            }
                          }}
                          placeholder={t('comments.replyPlaceholder')}
                          className="w-full p-2 bg-[#2d2d30] border border-gray-700 rounded resize-none focus:outline-none focus:border-blue-500 text-sm"
                          rows={2}
                        />
                        {profanityWarningReply && (
                          <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded">
                            <p className="text-yellow-400 text-xs">{t('comments.profanityWarning')}</p>
                          </div>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            size="1"
                            variant="ghost"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                              setProfanityWarningReply(false);
                            }}
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            size="1"
                            onClick={() => handleSubmitReply(comment.id)}
                            disabled={!replyText.trim()}
                          >
                            {t('comments.postReply')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-8 mt-4 space-y-3">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="bg-[#2d2d30] rounded p-3">
                        <div className="flex gap-2">
                          <img
                            src={reply.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.username}`}
                            alt="avatar"
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{reply.username}</span>
                              <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                              {isAuthenticated && reply.user_id === user?.id && (
                                <Button
                                  size="1"
                                  variant="ghost"
                                  color="red"
                                  onClick={() => handleDeleteComment(reply.id, true, comment.id)}
                                >
                                  <TrashIcon />
                                </Button>
                              )}
                            </div>
                            <div
                              className="text-gray-200 text-sm"
                              dangerouslySetInnerHTML={{ __html: highlightMentions(reply.content) }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center mt-6">
          <Button
            onClick={() => {
              setPage(prev => prev + 1);
              loadComments(page + 1);
            }}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('comments.loadMore')}
          </Button>
        </div>
      )}

      {comments.length === 0 && !loading && (
        <div className="text-center text-gray-400 py-8">
          {t('comments.noComments')}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
